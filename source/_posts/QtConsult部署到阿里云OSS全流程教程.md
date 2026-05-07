---
title: QtConsult部署到阿里云OSS全流程教程
date: 2026-05-07 20:19:03
categories:
  - 部署教程
tags:
  - QtConsult
  - 阿里云
  - OSS
  - GitHub Actions
---

# QtConsult 部署到阿里云 OSS 全流程

> 日期：2026-05-07
> 访问地址：https://consult.quanttide.com

---

## 一、整体架构

```
GitHub Repository (main branch)
        ↓ push
GitHub Actions (CI/CD)
        ↓
Flutter Build (Web)
        ↓
Aliyun OSS (静态托管)
        ↓
Cloudflare DNS (CNAME)
        ↓
用户访问 consult.quanttide.com
```

---

## 二、前置要求

### 2.1 阿里云资源

| 资源 | 说明 |
|------|------|
| OSS Bucket | 名称：`qtconsult-studio`，地域：杭州 |
| OSS 权限 | 具有读写权限的 AccessKey |
| DNS 域名 | `quanttide.com`，托管在阿里云 DNS |

### 2.2 GitHub 配置

在 GitHub 仓库 Settings → Secrets 中添加：
- `ALIYUN_ACCESS_KEY_ID` — 阿里云 AccessKey ID
- `ALIYUN_ACCESS_KEY_SECRET` — 阿里云 AccessKey Secret

---

## 三、Terraform 基础设施配置

### 3.1 目录结构

```
qtconsult/
├── terraform/
│   ├── main.tf
│   ├── variables.tf
│   └── terraform.tfvars
├── src/studio/          # Flutter 项目
├── scripts/
│   └── upload_oss.py    # OSS 上传脚本
└── .github/
    └── workflows/
        └── deploy.yml   # GitHub Actions
```

### 3.2 terraform/main.tf

```terraform
resource "alicloud_oss_bucket" "website" {
  bucket = var.bucket_name
  versioning { status = "Enabled" }
  website {
    index_document = var.index_document
    error_document = var.error_document
  }
}

resource "alicloud_alidns_record" "consult_cname" {
  domain_name = "quanttide.com"
  type       = "CNAME"
  rr         = "consult"
  value      = "${alicloud_oss_bucket.website.bucket}.${alicloud_oss_bucket.website.extranet_endpoint}"
  ttl        = 600
  status     = "ENABLE"
}

resource "alicloud_oss_bucket_cname" "consult" {
  bucket = alicloud_oss_bucket.website.bucket
  domain = var.domain_name
}
```

### 3.3 执行 Terraform

```bash
cd terraform
terraform init
terraform plan
terraform apply
```

**注意：**
- `bucket_domain` 属性不存在，使用 `extranet_endpoint`
- `record_type` 应为 `type`，`record_name` 应为 `rr`
- CNAME 值需要完整：`qtconsult-studio.oss-cn-hangzhou.aliyuncs.com`

---

## 四、GitHub Actions CI/CD 配置

### 4.1 .github/workflows/deploy.yml

```yaml
name: Deploy to OSS

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  FLUTTER_VERSION: "3.41.9"
  ALIYUN_BUCKET: qtconsult-studio
  ALIYUN_ENDPOINT: oss-cn-hangzhou.aliyuncs.com

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
        with:
          flutter-version: ${{ env.FLUTTER_VERSION }}
          channel: stable
      - working-directory: src/studio
        run: flutter pub get && flutter build web --release
      - uses: actions/upload-artifact@v4
        with:
          name: flutter-build
          path: src/studio/build/web

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: flutter-build
          path: build/web
      - name: Set env vars
        run: |
          echo "ALIYUN_ACCESS_KEY_ID=${{ secrets.ALIYUN_ACCESS_KEY_ID }}" >> $GITHUB_ENV
          echo "ALIYUN_ACCESS_KEY_SECRET=${{ secrets.ALIYUN_ACCESS_KEY_SECRET }}" >> $GITHUB_ENV
      - name: Upload to OSS
        run: |
          pip install oss2
          python3 -c '
import oss2, os
access_key_id = os.environ.get("ALIYUN_ACCESS_KEY_ID")
access_key_secret = os.environ.get("ALIYUN_ACCESS_KEY_SECRET")
auth = oss2.Auth(access_key_id, access_key_secret)
bucket = oss2.Bucket(auth, "oss-cn-hangzhou.aliyuncs.com", "qtconsult-studio")
for root, dirs, files in os.walk("build/web"):
    for file in files:
        local_path = os.path.join(root, file)
        oss_path = os.path.join(root, file).replace("build/web/", "")
        bucket.put_object_from_file(oss_path, local_path)
print("Upload complete")
'
```

### 4.2 跨平台文件处理 (.gitattributes)

```
*.yml text eol=lf
*.yaml text eol=lf
scripts/*.py text eol=lf
```

**Windows 用户必须添加此文件**，否则 GitHub Actions 会因 CRLF/LF 问题导致 YAML 解析失败。

---

## 五、OSS 上传脚本

### 5.1 scripts/upload_oss.py

```python
import oss2, os, sys

access_key_id = os.environ.get('ALIYUN_ACCESS_KEY_ID')
access_key_secret = os.environ.get('ALIYUN_ACCESS_KEY_SECRET')

auth = oss2.Auth(access_key_id, access_key_secret)
bucket = oss2.Bucket(auth, 'oss-cn-hangzhou.aliyuncs.com', 'qtconsult-studio')

for root, dirs, files in os.walk('build/web'):
    for file in files:
        local_path = os.path.join(root, file)
        oss_path = os.path.join(root, file).replace('build/web/', '')
        bucket.put_object_from_file(oss_path, local_path)
        print(f'Uploaded: {oss_path}')

print('Upload complete')
```

---

## 六、Cloudflare DNS 配置（备用）

如果 DNS 托管在 Cloudflare：

| 类型 | 名称 | 内容 | 代理状态 |
|------|------|------|----------|
| CNAME | consult | qtconsult-studio.oss-cn-hangzhou.aliyuncs.com | DNS only |

---

## 七、踩坑记录

### 7.1 Terraform 常见错误

| 错误 | 解决方法 |
|------|----------|
| `bucket_domain` attribute doesn't exist | 使用 `extranet_endpoint` |
| DNS record type 应该是 `type` 不是 `record_type` | 修正属性名 |
| CNAME 值缺少 bucket 前缀 | 完整填写 `qtconsult-studio.oss-cn-hangzhou.aliyuncs.com` |
| Bucket 名称全局已占用 | 改名 `qtconsult-studio` |

### 7.2 GitHub Actions 常见错误

| 错误 | 解决方法 |
|------|----------|
| `osztepang/aliyun-oss-upload-action` 不存在 | 改用 Python oss2 SDK |
| Flutter 版本 3.11.5 是 Dart SDK | 使用 `flutter-version: "3.41.9"` |
| YAML 多行字符串含 `${{ secrets }}` 解析错误 | 使用 heredoc + GITHUB_ENV |
| Windows CRLF 导致 YAML 解析失败 | 添加 `.gitattributes` 设置 LF |
| 403 Permission denied | 添加 `permissions:` 声明 |

### 7.3 阿里云 OSS 注意事项

- OSS Bucket 必须开启**静态网站托管**模式
- 自定义域名需要绑定 Bucket 并等待生效
- SSL 证书需要在 OSS 控制台手动激活（免费证书）
- CNAME 记录值必须是完整域名（包含 bucket 名称）

---

## 八、验证部署

部署完成后检查：

1. **OSS 控制台**：确认文件已上传
2. **访问测试**：`https://qtconsult-studio.oss-cn-hangzhou.aliyuncs.com`
3. **自定义域名**：`https://consult.quanttide.com`
4. **SSL 证书**：浏览器地址栏锁标

---

## 九、总结

| 项目 | 值 |
|------|---|
| 仓库 | https://github.com/quanttide/qtconsult |
| 访问地址 | https://consult.quanttide.com |
| OSS Bucket | qtconsult-studio |
| 部署方式 | GitHub Actions → Python oss2 SDK → Aliyun OSS |
| DNS | 阿里云 DNS，CNAME 到 OSS |
| SSL | 阿里云免费证书（手动激活） |
