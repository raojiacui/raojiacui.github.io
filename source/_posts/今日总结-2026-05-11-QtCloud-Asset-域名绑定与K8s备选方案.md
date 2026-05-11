---
title: 今日总结-2026-05-11-QtCloud Asset 域名绑定与 K8s 备选方案
date: 2026-05-11
tags:
  - 工作总结
  - 阿里云
  - GitHub Actions
  - Function Compute
  - Kubernetes
  - Docker
  - QtCloud Asset
categories:
  - 工作记录
---

# 今日总结：QtCloud Asset 域名绑定与 K8s 备选方案

今天继续处理 `qtcloud-asset` 的正式域名问题。原目标很明确：

```text
前端 Studio:
https://asset.quanttide.com

后端 Provider:
https://api.asset.quanttide.com
```

上次已经把前后端链路跑通，但后端还临时使用 FC 默认域名：

```text
https://provide-package-tuzknrkwac.cn-hangzhou.fcapp.run
```

今天主要围绕 `api.asset.quanttide.com` 的正式绑定继续推进。

## 一、确认当前可用状态

先复盘了 5 月 9 日的总结和当前部署状态。结论是：

```text
Provider package workflow: success
Studio workflow: success
http://asset.quanttide.com: 可访问
https://asset.quanttide.com: 证书信任仍有问题
api.asset.quanttide.com: 还没有正式可用
```

GitHub Actions 上最新几次部署也都能跑通，说明 CI、打包、OSS 上传这条链路本身没有断。

## 二、继续尝试 FC 自定义域名

今天最开始仍然尝试把后端绑定到 Function Compute 自定义域名：

```text
api.asset.quanttide.com
```

Terraform 里之前已经做过可选开关：

```hcl
enable_provider_custom_domain = false
```

如果后续备案归属校验通过，把它改成 `true` 就可以创建 FC 自定义域名和 DNS CNAME。

今天进一步确认了 FC v3 的自定义域名资源支持 HTTPS 证书配置，也就是说技术上可以做到：

```text
api.asset.quanttide.com -> FC provider-package
```

并支持证书。

但实际在阿里云控制台操作时，仍然卡在备案接入校验：

```text
未接入阿里云
```

这里关键点是：RAM 子账号权限和备案接入归属不是一回事。即使 RAM 子账号有 FC、DNS、证书权限，FC 创建自定义域名时仍会校验：

```text
当前 FC 所属主账号是否拥有 / 接入了 quanttide.com 的备案
```

所以今天最终判断：这个问题不是代码问题，也不是 GitHub Actions 问题，而是域名备案接入和当前阿里云主账号归属的校验问题。

## 三、申请 SSL 证书的流程也梳理了一遍

今天还梳理了阿里云免费 SSL 证书的申请路径。

免费证书现在在阿里云里通常叫：

```text
个人测试证书（免费版）
```

申请时应该选择：

```text
CSR 生成方式: 系统生成
域名验证方式: 自动 DNS 验证
资源组: 默认资源组或项目资源组
```

这里也确认了一个点：证书申请和 FC 自定义域名绑定是两件事。证书可以申请，但 FC 绑定 `api.asset.quanttide.com` 仍然会单独做 ICP 接入校验。

## 四、切换思路：评估 K8s 方案

因为 FC 自定义域名被备案接入挡住，今天临时改为评估 Kubernetes 方案：

```text
api.asset.quanttide.com -> Ingress -> provider 容器
```

为此在仓库里新增了 Docker 和 K8s 部署配置。

主要提交包括：

```text
256f8de enable provider deployment on kubernetes
da0f0fd deploy provider image to kubernetes
b07db03 harden kubernetes deploy kubeconfig handling
a68ccda run kubernetes deploy on manifest changes
```

新增或调整的关键文件：

```text
.github/workflows/deploy-provider-image.yml
.github/workflows/deploy-provider-k8s.yml
manifests/docker/Dockerfile.provider
manifests/docker/.dockerignore
manifests/k8s/namespace.yaml
manifests/k8s/provider.yaml
manifests/k8s/README.md
src/provider/app/main.py
src/studio/lib/main.dart
```

## 五、Docker 镜像构建已经打通

原来的 `Dockerfile.provider` 使用 `uv` 镜像，并且 `.dockerignore` 把整个 `src/provider/` 排除了，会导致构建上下文不完整。

今天改成了更直接的 Python 镜像：

```dockerfile
FROM python:3.12-slim
```

并使用：

```text
src/provider/requirements.txt
```

安装依赖。

新增的 GitHub Actions workflow 会把镜像推送到阿里云个人版 ACR：

```text
crpi-uorshhk4a32pmmio.cn-hangzhou.personal.cr.aliyuncs.com/quanttide/qtcloud-asset-provider:latest
```

今天验证结果：

```text
Deploy Provider Image: success
```

说明镜像构建和推送已经打通。

## 六、K8s 部署 workflow 已经写好，但缺集群

今天还新增了 K8s 部署 workflow：

```text
Deploy Provider to Kubernetes
```

它会做这些事：

```text
1. 读取 KUBE_CONFIG
2. 创建 namespace: qtcloud-asset
3. 创建 ACR pull secret
4. 创建 TLS secret
5. apply manifests/k8s/provider.yaml
6. 等待 Deployment rollout
```

K8s 清单包括：

```text
Namespace
Deployment
Service
Ingress
```

Ingress 目标域名是：

```text
api.asset.quanttide.com
```

但实际部署失败，因为当前还没有可用的 ACK kubeconfig。GitHub Actions 里报过：

```text
kubectl fallback 到 localhost:8080
```

后来 workflow 已经增强为显式检查 `KUBE_CONFIG`，也支持原始 kubeconfig 或 base64 kubeconfig。

不过最后讨论下来，ACK/K8s 本身会产生费用：

```text
ACK 集群
Worker 节点
Ingress/SLB
公网流量
```

对于当前只有一个 FastAPI provider 的场景，K8s 有点重。

## 七、成本和方案判断

今天最后重新比较了几种方案。

### 方案 1：继续用 FC 默认域名

```text
https://provide-package-tuzknrkwac.cn-hangzhou.fcapp.run
```

优点：

```text
成本最低
当前已经跑通
不需要额外服务器或集群
```

缺点：

```text
不是正式 API 域名
```

### 方案 2：解决 FC 备案接入问题

最终目标：

```text
https://api.asset.quanttide.com -> FC provider-package
```

优点：

```text
最符合当前 FaaS 架构
不需要维护服务器
成本比 ECS / ACK 低
```

缺点：

```text
需要确认 quanttide.com 的备案接入是否在当前 FC 所属主账号下
```

### 方案 3：ECS / 轻量应用服务器 + Docker + Nginx

优点：

```text
比 ACK 简单
比 K8s 便宜
可以绑定 api.asset.quanttide.com
```

缺点：

```text
仍然有服务器费用
需要维护服务器和 Nginx
```

### 方案 4：ACK / K8s

优点：

```text
工程化程度高
以后扩展服务方便
```

缺点：

```text
成本最高
对当前单服务过重
```

今天最后结论是：暂时不继续创建 ACK 集群，明天再决定是否继续 FC 备案接入，还是改走 ECS / 轻量服务器。

## 八、今天的验证

今天完成并验证了：

```text
GitHub Actions YAML 解析通过
K8s YAML 解析通过
provider Python compile 通过
Terraform validate 通过
Provider image workflow 成功
Provider package workflow 成功
Studio workflow 成功
```

本地没有 Docker、kubectl、aliyun CLI，所以本地不能直接构建镜像或操作 ACK。镜像构建已经交给 GitHub Actions 完成。

## 九、明日待办

明天继续前，先决定正式路线：

1. 继续查 `quanttide.com` 的备案接入归属，确认是否能在当前 FC 主账号下绑定 `api.asset.quanttide.com`。
2. 如果 FC 能解决，回到 FC 自定义域名方案，避免额外服务器成本。
3. 如果 FC 备案接入短期解决不了，再评估轻量应用服务器 / ECS。
4. 暂时不建议为了一个 provider 创建 ACK 集群，除非后续明确要 Kubernetes 化。
5. 如果继续 K8s，需要先创建 ACK 集群，并把公网 kubeconfig 写入 GitHub Secret：

   ```text
   KUBE_CONFIG
   ```

6. 如果走 ECS，需要补 Docker Compose / Nginx / systemd 或部署脚本。

## 当前状态

```text
前端 asset.quanttide.com:
HTTP 可访问，HTTPS 证书问题待处理

后端 FC 默认域名:
可用

后端 api.asset.quanttide.com:
目标域名已写入前端和 provider 配置，但正式服务尚未部署成功

Provider Docker 镜像:
已通过 GitHub Actions 构建并推送到 ACR

K8s 清单和部署 workflow:
已准备，但缺 ACK 集群和 KUBE_CONFIG
```

今天最大的结论是：域名绑定问题已经从“代码怎么配”推进到了“云资源和成本路线怎么选”。FC 仍然是当前最省成本的正式方案，但前提是把备案接入归属问题解决掉。
