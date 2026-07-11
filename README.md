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

- `source`：唯一的源码分支，也是 GitHub 默认分支。后续写文章只提交这里。
- `gh-pages`：唯一的静态站点发布分支，也是 GitHub Pages 发布源。

历史上的 `main`、`master`、`main-backup` 已清理。不要直接在 `gh-pages` 上手改文件，因为下次部署会覆盖它。

## 主题定制

线上构建会先克隆官方 `hexo-theme-landscape`，再把 `theme-overrides/landscape/` 覆盖进去。文章首页折叠效果就放在这里。

不要直接提交 `themes/landscape/`。它是本地构建/预览用的主题目录，里面可能带有嵌套 Git 仓库，已经在 `.gitignore` 中忽略。
