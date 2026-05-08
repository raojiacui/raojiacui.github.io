---
title: Hexo博客部署到GitHub Pages流程教程
date: 2026-05-08
tags:
  - Hexo
  - GitHub Pages
  - 博客
  - 部署教程
categories:
  - 部署教程
---

# Hexo 博客部署到 GitHub Pages 流程教程

这篇文档记录当前博客的标准部署流程。博客源仓库和发布仓库使用同一个 GitHub 仓库的不同分支：

```text
仓库：https://github.com/raojiacui/raojiacui.github.io
源码分支：source
发布分支：main
本地路径：C:\Users\雨下雨停\hexo-blog
线上地址：https://raojiacui.github.io/
```

## 一、整体流程

完整流程分成两件事：

```text
1. Hexo 构建并部署静态站点到 main 分支
2. Git 提交 Markdown 源文件到 source 分支
```

注意：`hexo deploy` 只会推送生成后的静态 HTML，不会自动保存 Markdown 源文件。因此每次写完文章以后，都要单独提交 `source/_posts/` 里的源文件。

## 二、进入博客源仓库

在 PowerShell 中进入博客目录：

```powershell
cd C:\Users\雨下雨停\hexo-blog
```

确认当前分支是 `source`：

```powershell
git branch --show-current
```

正常应该输出：

```text
source
```

## 三、新建博客文章

文章放在：

```text
source/_posts/
```

例如：

```text
source/_posts/今日总结-2026-05-08-QtAdmin-QtConsult-QtCloud-Asset-部署与发版.md
```

文章开头必须写 Hexo front matter：

```markdown
---
title: 今日总结-2026-05-08-标题
date: 2026-05-08
tags:
  - 工作总结
categories:
  - 工作记录
---
```

常用分类：

```text
工作记录
部署教程
开发记录
```

常用标签：

```text
工作总结
Hexo
GitHub Pages
阿里云
GitHub Actions
QtConsult
QtAdmin
QtCloud Asset
```

## 四、本地构建

PowerShell 里不要直接执行：

```powershell
npm run build
```

因为 Windows 可能会阻止运行 `npm.ps1`，报执行策略错误。应该使用：

```powershell
npm.cmd run build
```

这个命令等价于：

```powershell
hexo generate
```

构建成功时会看到类似输出：

```text
INFO  Validating config
INFO  Start processing
INFO  Generated: index.html
INFO  Generated: 2026/05/08/文章标题/index.html
INFO  X files generated
```

如果构建失败，先不要部署。需要先根据报错修复 Markdown、front matter 或 Hexo 配置。

## 五、部署到 GitHub Pages

构建通过后执行：

```powershell
npm.cmd run deploy
```

这个命令等价于：

```powershell
hexo deploy
```

当前 `_config.yml` 中的部署配置是：

```yaml
deploy:
  type: git
  repo: https://github.com/raojiacui/raojiacui.github.io.git
  branch: main
  message: "Site updated: YYYY-MM-DD HH:mm:ss"
```

也就是说，`hexo deploy` 会把 `public/` 目录里的静态文件推送到：

```text
raojiacui.github.io 仓库的 main 分支
```

部署成功时会看到类似输出：

```text
INFO  Deploying: git
INFO  Clearing .deploy_git folder...
INFO  Copying files from public folder...
INFO  Deploy done: git
```

## 六、提交 Markdown 源文件

部署完成后，还要把文章源文件提交到 `source` 分支。

先查看状态：

```powershell
git status --short
```

只添加本次新增或修改的 Markdown 文章。例如：

```powershell
git add source/_posts/今日总结-2026-05-08-QtAdmin-QtConsult-QtCloud-Asset-部署与发版.md
```

提交：

```powershell
git commit -m "docs: add May 8 deployment summary"
```

推送源码分支：

```powershell
git push origin source
```

## 七、验证线上页面

打开首页：

```text
https://raojiacui.github.io/
```

如果首页暂时没有出现新文章，可以等 1 到 3 分钟再刷新。GitHub Pages 有时会有缓存和发布延迟。

也可以直接访问文章路径，路径一般是：

```text
https://raojiacui.github.io/年/月/日/文章标题/
```

例如：

```text
https://raojiacui.github.io/2026/05/08/今日总结-2026-05-08-QtAdmin-QtConsult-QtCloud-Asset-部署与发版/
```

如果 `hexo deploy` 已经成功，但线上还没有变化，优先等待一会儿；如果仍然没有变化，再检查 GitHub Pages 设置是否指向 `main` 分支。

## 八、常见问题

### 1. PowerShell 报 npm.ps1 无法加载

错误类似：

```text
无法加载文件 C:\Program Files\nodejs\npm.ps1，因为在此系统上禁止运行脚本
```

解决办法：使用 `npm.cmd`：

```powershell
npm.cmd run build
npm.cmd run deploy
```

### 2. 部署成功但线上没更新

先等 1 到 3 分钟。GitHub Pages 发布和浏览器缓存都有延迟。

如果仍然没有更新，检查：

```powershell
git ls-remote --heads https://github.com/raojiacui/raojiacui.github.io.git
```

确认 `main` 分支有新提交。

也要确认 `_config.yml` 里部署分支是：

```yaml
branch: main
```

### 3. Markdown 源文件没有保存到 GitHub

这是因为 `hexo deploy` 只推静态文件，不推源文件。

需要手动执行：

```powershell
git add source/_posts/文章.md
git commit -m "docs: add article"
git push origin source
```

### 4. 仓库里有 debug.log 或 themes 未跟踪

如果 `git status --short` 看到：

```text
?? debug.log
?? themes/
```

不要随便提交。它们是之前就存在的本地杂项，不属于每次文章发布的必要内容。

发布文章时只添加本次要提交的 Markdown 文件。

## 九、标准命令清单

每次发布一篇文章，最常用的命令是：

```powershell
cd C:\Users\雨下雨停\hexo-blog

npm.cmd run build
npm.cmd run deploy

git status --short
git add source/_posts/你的文章.md
git commit -m "docs: add article"
git push origin source
```

## 十、一次成功发布的判断标准

一次完整发布应该满足：

1. `npm.cmd run build` 成功。
2. `npm.cmd run deploy` 成功。
3. GitHub Pages 首页能看到新文章。
4. Markdown 源文件已经提交到 `source` 分支。
5. 没有把 `debug.log`、`themes/` 等无关文件一起提交。

这样既能保证线上博客更新，也能保证文章源码可追溯。
