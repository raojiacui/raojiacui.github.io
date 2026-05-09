---
title: 今日总结-2026-05-09-QtCloud Asset FaaS 前后端部署跑通
date: 2026-05-09
tags:
  - 工作总结
  - 阿里云
  - GitHub Actions
  - Function Compute
  - OSS
  - QtCloud Asset
categories:
  - 工作记录
---

# 今日总结：QtCloud Asset FaaS 代码包部署与前后端联通

今天主要继续昨天没有完成的 `qtcloud-asset` 部署工作。目标很明确：把 `provider` 服务端真正部署到阿里云 Function Compute，并让 `studio` 前端能访问到后端服务。

最终结果是前后端链路已经跑通：

```text
前端 Studio:
http://asset.quanttide.com

后端 Provider:
https://provide-package-tuzknrkwac.cn-hangzhou.fcapp.run
```

页面现在可以打开，并且能显示 provider 状态：

```text
service: qtcloud-asset-provider
status: ok
```

## 一、接着昨天的 provider package workflow

昨天最后留下的待办是：把 provider workflow 的打包命令从系统 `zip` 改为 Python 自带的 `zipfile`。

今天先完成了这个修正：

```text
python -m zipfile -c ../qtcloud-asset-provider.zip .
```

这里有一个关键点：zip 必须以 `build/provider` 为根目录打包，不能把 `build/provider/` 这层路径一起放进包里。Function Compute 解压代码包后，需要能直接在代码根目录看到：

```text
app/main.py
fastapi/
uvicorn/
```

修完后，GitHub Actions 的 `package` job 成功，说明代码包构建已经没问题。

## 二、OSS 上传失败：AccessKey 无效

接下来 provider workflow 失败在 OSS 上传阶段。日志里阿里云 OSS 返回：

```text
403 InvalidAccessKeyId
The OSS Access Key Id you provided does not exist in our records.
```

这说明问题不是 workflow 语法，也不是 ossutil 下载，而是 GitHub Actions Secrets 里的阿里云 AccessKey 无效。

更新 GitHub Secrets 后，重新触发 provider workflow，代码包成功上传到 OSS。

## 三、Terraform provider source 问题

运行 `terraform apply` 时又遇到一个 Terraform provider 问题。根模块声明了：

```hcl
source = "aliyun/alicloud"
```

但 `modules/fc` 子模块里没有声明 `required_providers`，Terraform 把模块里的 `alicloud_*` 资源误解析成：

```text
hashicorp/alicloud
```

修复方式是在 `modules/fc/main.tf` 里补上：

```hcl
terraform {
  required_providers {
    alicloud = {
      source = "aliyun/alicloud"
    }
  }
}
```

之后 `terraform validate` 和 `terraform providers` 都正常。

## 四、已有 provider 函数不能原地切 runtime

第一次 apply 时，阿里云返回：

```text
FunctionAlreadyExists
function 'provider' already exists
```

说明云上已经有一个叫 `provider` 的函数。导入 state 后发现它是昨天容器路线创建的 `custom-container` 函数。

继续 apply 时，FC 又返回：

```text
The change of runtime from 'custom-container' from 'custom.debian12' is not supported
```

这个限制很关键：FC 不支持把已有函数从 `custom-container` 原地改成 `custom.debian12` 代码包 runtime。

为了不删除已有函数，今天采用了新函数名：

```text
provider-package
```

这样保留旧函数，同时用 Terraform 创建新的代码包函数。

## 五、FC 启动命令与 Python ABI 问题

新函数创建成功后，公网地址是：

```text
https://provide-package-tuzknrkwac.cn-hangzhou.fcapp.run
```

但第一次访问 `/health` 失败，FC 日志显示：

```text
No such file or directory: uvicorn
```

原因是 `uvicorn` console script 不在 FC runtime 的 PATH 里。于是启动命令改为：

```text
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 9000
```

之后又遇到第二个问题：

```text
ModuleNotFoundError: No module named 'pydantic_core._pydantic_core'
```

这个问题是 ABI 不匹配。GitHub Actions 用 Python 3.12 打包依赖，而 FC `custom.debian12` 里实际是 Python 3.11。

最后把 workflow 的 Python 版本改为：

```yaml
python-version: "3.11"
```

并把代码包路径改成：

```text
provider/qtcloud-asset-provider-py311.zip
```

这样重新上传后，FC 成功启动，`/health` 和 `/` 都返回正常。

## 六、后端自定义域名暂时受备案校验限制

本来想给后端绑定：

```text
api.asset.quanttide.com
```

Terraform 里也已经尝试了 `alicloud_fcv3_custom_domain` 和 DNS CNAME 自动化配置。

但阿里云 FC 返回：

```text
InvalidICPLicense
domain name 'api.asset.quanttide.com' has not got ICP license,
or the ICP license does not belong to Aliyun
```

这说明当前问题不是 DNS 解析，而是 FC 创建自定义域名前的 ICP 备案/接入归属校验没有通过。

所以今天先把自定义域名做成 Terraform 可选开关：

```hcl
enable_provider_custom_domain = false
```

等备案接入问题解决后，再打开这个开关即可自动创建后端自定义域名。

## 七、采用临时方案：前端用 OSS 域名，后端用 FC 默认域名

为了先让系统可用，今天采用了方案 2：

```text
前端:
http://asset.quanttide.com

后端:
https://provide-package-tuzknrkwac.cn-hangzhou.fcapp.run
```

也就是说，前端仍然部署在 OSS，用户访问 `asset.quanttide.com`；前端代码里临时调用 FC 默认域名。

为了让浏览器允许跨域访问，在 FastAPI 里加了 CORS：

```text
allow_origins:
  - https://asset.quanttide.com
  - http://asset.quanttide.com
```

并增加了一个 `/config` 接口，用来确认当前 provider 配置：

```json
{
  "provider_base_url": "https://provide-package-tuzknrkwac.cn-hangzhou.fcapp.run",
  "studio_origin": "https://asset.quanttide.com",
  "cors": "enabled"
}
```

## 八、Studio 前端从 Demo 改成状态页

`src/studio` 原来还是 Flutter 默认计数器页面。今天把它改成一个最小的 QtCloud Asset 状态页：

```text
QtCloud Asset
Digital Asset Console
Provider status
```

页面启动后会请求：

```text
GET https://provide-package-tuzknrkwac.cn-hangzhou.fcapp.run/health
```

如果成功，就展示：

```text
Service: qtcloud-asset-provider
Status: ok
Endpoint: https://provide-package-tuzknrkwac.cn-hangzhou.fcapp.run
```

这一步让 `studio` 不再只是一个静态空壳，而是实际连上了服务端。

## 九、OSS 静态站点权限问题

前端 workflow 成功后，访问：

```text
http://asset.quanttide.com
```

一开始返回：

```text
AccessDenied
Anonymous access is forbidden
```

这说明 DNS 已经指到了 OSS，但 bucket 不允许匿名读取。手动调整后页面可以访问。

为了让配置可追踪，今天把 OSS bucket ACL 写进 Terraform：

```hcl
resource "alicloud_oss_bucket_acl" "studio_public_read" {
  bucket = alicloud_oss_bucket.studio.bucket
  acl    = "public-read"
}
```

这样后续 Terraform apply 不会和手动配置漂移。

## 十、最终验证

今天最终验证了这些点：

```text
Provider workflow: success
Studio workflow: success
Terraform validate: success
Provider /health: ok
Provider /config: cors enabled
Studio main.dart.js: 包含 QtCloud Asset 标识和 FC provider 地址
浏览器访问 http://asset.quanttide.com: 页面能打开并显示 Provider status ok
```

当前可用地址：

```text
前端:
http://asset.quanttide.com

后端:
https://provide-package-tuzknrkwac.cn-hangzhou.fcapp.run

后端健康检查:
https://provide-package-tuzknrkwac.cn-hangzhou.fcapp.run/health
```

## 十一、今天的关键收获

今天最大的收获是：FaaS 部署不只是“把代码传上去”，而是要把 CI 打包环境、运行时版本、云产品限制和前端访问方式串起来。

这次踩到的关键点包括：

```text
1. zip 包根目录必须正确
2. GitHub Secrets 必须是有效的阿里云 AccessKey
3. Terraform 子模块必须声明 aliyun/alicloud provider source
4. FC 不支持 custom-container 原地切到 custom.debian12
5. Python 依赖包必须和 FC runtime 的 Python 小版本匹配
6. 后端自定义域名受 ICP 接入校验限制
7. OSS 静态网站需要 public-read
8. 前端跨域调用 FC 默认域名需要 CORS
```

## 十二、后续待办

后续可以继续做：

1. 处理 `asset.quanttide.com` 的 HTTPS 证书问题。
2. 处理 `api.asset.quanttide.com` 的 ICP 接入校验。
3. 备案/接入通过后，把后端从 FC 默认域名切到：

   ```text
   https://api.asset.quanttide.com
   ```

4. 把前端里的 provider 地址从硬编码改成构建参数或运行时配置。
5. 继续补 provider 的真实业务 API，而不是只保留 `/health` 和 `/config`。
6. 清理仓库里未跟踪的 Terraform backup 文件，避免误提交。

## 当前状态

```text
qtcloud-asset studio：已部署到 OSS，http://asset.quanttide.com 可访问
qtcloud-asset provider：已部署到 FC，默认公网域名可访问
前后端联通：已完成
后端自定义域名：暂缓，等待 ICP 接入校验
HTTPS：前端证书仍需后续处理
```

今天的结论是：`qtcloud-asset` 已经从“部署探索”推进到“前后端可用”。虽然正式域名和 HTTPS 还有后续工作，但核心链路已经打通，服务端也确实跑在阿里云 FaaS 上。
