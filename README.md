# Hexo Blog 发布说明

这个仓库统一按一条链路管理：

```text
source 分支：博客源码，写文章、改配置都在这里
  -> GitHub Actions 自动构建 Hexo
  -> gh-pages 分支：生成后的静态站点
  -> GitHub Pages 对外访问
```

## 日常发文章

1. 在 `source/_posts/` 下新增或修改 Markdown。
2. 本地验证：

```bash
npm run build
```

3. 提交源码：

```bash
git status
git add source/_posts/xxx.md
git commit -m "add blog post"
git push origin source
```

4. 推送 `source` 后，GitHub Actions 会自动构建并发布到 `gh-pages`。

## 本地预览

```bash
npm run server
```

## 手动部署

正常情况下不需要手动部署。只有 GitHub Actions 失败时才用：

```bash
npm run build
npm run deploy
```

`_config.yml` 里的手动部署目标已经和 GitHub Actions 统一为 `gh-pages`。

## 分支约定

- `source`：唯一的源码分支，后续写文章只提交这里。
- `gh-pages`：唯一的静态站点发布分支，由 GitHub Actions 或 `npm run deploy` 生成。
- `main`：旧的手动 Hexo 静态部署分支，后续不再使用。
- `master`：旧的源码/历史分支，后续不再使用。
- `main-backup`：历史备份分支，后续不再使用。

不要直接在 `gh-pages` 上手改文件，因为下次部署会覆盖它。