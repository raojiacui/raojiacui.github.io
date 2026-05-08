---
title: 今日总结-2026-05-08-QtAdmin、QtConsult 与 QtCloud Asset 部署发版
date: 2026-05-08
tags:
  - 工作总结
  - 阿里云
  - GitHub Actions
  - Function Compute
  - QtConsult
  - QtAdmin
  - QtCloud Asset
categories:
  - 工作记录
---

# 今日总结：从 QtAdmin 部署，到 QtConsult 发版，再到 QtCloud Asset FaaS 部署探索

今天主要做了三条线的事情：

1. 部署 `qtadmin` 到阿里云 OSS。
2. 联调 `qtconsult` 前后端并发布三个版本。
3. 部署 `qtcloud-asset`，重点探索 `provider` 服务端上 FaaS。

## 一、QtAdmin 部署到阿里云

一开始先克隆了 `qtadmin` 仓库，然后参考昨天 `qtconsult` 的 Terraform + GitHub Actions 流程，把 `qtadmin` 的 Studio 前端部署到阿里云 OSS。

整体流程是：

```text
Flutter Web build -> OSS bucket -> DNS CNAME -> GitHub Actions 自动部署
```

部署过程中遇到过 Flutter Web build 失败的问题。后面修复了构建相关配置，让 GitHub Actions 可以成功构建并上传到 OSS。最终 `qtadmin` 的 OSS 静态站点部署跑通，域名绑定也完成了。

这部分学到的是：`qtadmin` 和 `qtconsult studio` 这类前端应用，只要本质是 Flutter Web 静态资源，就适合走 OSS。GitHub 仓库有变更后，只要 workflow 配好，push 到指定分支就会自动构建并同步到阿里云 OSS。

## 二、QtConsult 前后端联调与版本发布

老板给的方向是：`qtconsult-provider -> qtconsult-archive`，并且提到了 `docs/dev/storage.md` 里的归档机制。核心目标不是单纯发版，而是通过前后端联调理解系统架构，把 provider、studio 和整体应用串起来。

今天在 `qtconsult` 里完成了这些事情：

1. 适配 provider 的 S3/OSS 风格存储配置。
2. 补 provider 测试。
3. 让 studio 通过 `ProviderService` 访问 provider。
4. 修复 Web 端缓存兼容问题。
5. 增加 fixture fallback，保证前端在 provider 不可用时也能有可展示数据。
6. 修复 OSS2 相关 Studio 部署问题。

之后发布了三个版本：

```text
provider/v0.1.0
studio/v0.1.0
v0.1.0
```

对应 GitHub Releases 也创建好了，release notes 后来改成了中文说明。

这部分最重要的收获是：`qtconsult` 不是一个孤立前端，也不是一个孤立 provider，而是要把应用层产品和领域层能力接起来。老板提到的看板方法，其实是在推动几个产品在工作流定义上统一：

```text
量潮咨询
量潮数据
量潮项目云
```

比如咨询可以被定义为：

```text
调研 -> 分析 -> 决策 -> 执行
```

而数据、项目也有类似的 workflow 定义。GitHub Projects 比较贴合老板的工作习惯，但在复杂项目结构组织上不好用，所以后续产品要吸收它的优点，同时解决它的不足。

## 三、GitHub Token 与权限问题

中间遇到了 GitHub 登录失败的问题。一开始怀疑是网络问题，后来改用 token。token 用完后，我也意识到：一旦把 GitHub PAT 贴到对话里，就应该立刻删除或 revoke。

后续更好的做法是：

1. 尽量用 `gh auth login` 在本机授权。
2. 或者用 GitHub Secrets。
3. 不要在聊天窗口直接长期暴露 PAT。

## 四、QtCloud Asset 部署

老板说服务端用 FaaS 部署，所以先判断了 `qtcloud-asset` 的结构：

```text
src/studio   -> 前端静态站点，部署到 OSS
src/provider -> 服务端 API，部署到 Function Compute
```

### 1. Studio 部署到 OSS

`studio` 先沿用 OSS 流程。创建和使用的资源包括：

```text
bucket: qtcloud-asset-studio
domain: asset.quanttide.com
```

这里遇到了 OSS 官方 CLI 下载问题。前几次下载到的不是正确二进制，而是 XML 错误页或错误格式文件，导致 GitHub Actions 报错：

```text
syntax error near unexpected token `newline'
gzip: stdin: not in gzip format
```

后来改成阿里云官方 `ossutil v2` 的正确 zip 包地址：

```text
https://gosspublic.alicdn.com/ossutil/v2/2.2.1/ossutil-2.2.1-linux-amd64.zip
```

并用官方 CLI 上传，最终 Studio 部署流程跑通。

### 2. Provider 容器路线探索

接着处理 `provider`。先补了一个最小 FastAPI 服务：

```text
GET /
GET /health
```

并写了 Dockerfile，准备走：

```text
Docker image -> ACR -> FC custom-container
```

最开始镜像推到了个人版 ACR：

```text
crpi-uorshhk4a32pmmio.cn-hangzhou.personal.cr.aliyuncs.com/quanttide/qtcloud-asset-provider
```

GitHub Actions 能推送成功，但 Terraform 创建 FC 函数失败：

```text
Image not stored in ACR is not supported yet
Image and function must be in the same region
```

之后尝试过：

1. FC v2。
2. FC v3。
3. 关闭镜像加速。
4. 配置 `acr_instance_id`。
5. 改用 `registry.cn-hangzhou.aliyuncs.com`。
6. 手动在 FC 控制台创建函数。

最后确认：FC 控制台也不接受这个 `crpi` 镜像地址，报 `InvalidImageFormat`。所以问题不是 Terraform 写错，而是 FC 当前不认这个新版个人版 ACR 域名。

标准 ACR 地址理论上更适合 FC：

```text
registry.cn-hangzhou.aliyuncs.com/quanttide/qtcloud-asset-provider
```

但 GitHub Actions 登录时报：

```text
403 Forbidden
```

说明当前 registry 账号密码不能登录这个标准地址。企业版 ACR 可以解决，但会产生费用，所以今天没有继续走企业版路线。

### 3. 改为 FC 代码包部署

最后把方案调整为：不用容器镜像，改用 FC 代码包部署。这仍然是 FaaS，但绕开 ACR：

```text
GitHub Actions 在 Ubuntu 上安装 provider 依赖
打包 FastAPI 代码为 zip
上传 zip 到 OSS
Terraform 用 custom.debian12 创建 FC 函数
启动命令 uvicorn
端口 9000
健康检查 /health
```

这部分已经提交了一版基础改造：

```text
fix: deploy asset provider as fc package
```

不过最后一轮 workflow 还没有完全跑通。当前还有一个待处理的小改动：把打包命令从系统 `zip` 改成 Python 自带 `zipfile`，减少 GitHub Actions 环境依赖。

## 五、今天学到的东西

今天最重要的是把三类部署方式区分清楚了：

```text
静态前端：Flutter Web -> OSS
服务端容器：Docker -> ACR -> FC custom-container
服务端代码包：Python/FastAPI -> zip -> OSS -> FC custom runtime
```

`qtadmin`、`qtconsult studio`、`qtcloud-asset studio` 都属于第一类，所以 OSS 很合适。

`qtcloud-asset provider` 是服务端，不能简单当成静态站点上传 OSS。老板说 FaaS，所以应该用 FC。但 FC custom-container 又引入 ACR 镜像兼容问题。今天证明了新版个人版 `crpi` 域名目前在这个场景不顺，所以改走代码包部署更省钱、更现实。

另一个经验是：遇到云产品集成问题时，要区分三类错误：

```text
1. 代码错误：服务本身不能启动
2. CI/CD 错误：构建、上传、登录失败
3. 云产品约束：控制台和 API 都不接受某种资源组合
```

今天 `provider` 容器部署的问题最终属于第三类，不是简单改代码能解决的。

## 六、下次继续做什么

下次建议从这里继续：

1. 提交 provider workflow 的 `zipfile` 修正。
2. 推送后观察 `Deploy Provider Package` workflow。
3. 如果失败，查看 GitHub Actions 具体红色日志。
4. workflow 成功上传 zip 到 OSS 后，运行 `terraform apply`。
5. 创建 FC custom runtime provider 函数。
6. 测试 `/health` 和 `/`。
7. 把最终 provider 公网地址写入 README 或部署文档。

## 当前状态

```text
qtadmin：已部署
qtconsult：已联调并发布 provider/v0.1.0、studio/v0.1.0、v0.1.0
qtcloud-asset studio：OSS 流程已跑通
qtcloud-asset provider：容器路线已确认受 ACR/FC 限制，正在切换为 FC 代码包部署
```

今天的结论是：前端部署流程已经比较稳定，服务端 FaaS 部署的关键不在代码，而在云产品的镜像和运行时约束。后续继续把 provider 的代码包部署跑通，就能避开 ACR 企业版成本，同时满足“服务端用 FaaS”的要求。
