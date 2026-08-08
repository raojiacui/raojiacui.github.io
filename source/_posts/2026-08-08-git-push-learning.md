---
title: Git 推送学习：从 git status 到 GitHub 大文件限制
date: 2026-08-08 12:00:00
tags: [git, GitHub, 学习笔记]
categories: 学习笔记
---

记录一下AI额度没了被迫查命令手动推送的一次实践

## 1. 查看改动：`git status`

改完代码后第一步自然是看有哪些文件发生了变化：

```bash
git status
```

终端里出现了两类红色文字：

- `modified: xxx`：已经被 Git 跟踪的文件发生了改动，但这些改动还没有进入暂存区。
- `Untracked files:`：全新的文件，Git 还没跟踪过。

Git 也给了很明确的提示：

> Changes not staged for commit.  
> use "git add <file>..." to update what will be committed.  
> use "git restore <file>..." to discard changes in working directory.

也就是说：**红色代表工作区（working directory）的改动，绿色才代表已经进入暂存区（staging area），可以被提交。**

## 2. 加入暂存区：`git add`

执行：

```bash
git add .
```

`.` 表示把当前目录下所有改动都加入暂存区。如果想只加某个文件，可以写具体路径：

```bash
git add app/api/generation-jobs/route.ts
```

再次 `git status` 时，文件就变成了绿色，说明它们已经准备好被提交了。

> 注意：执行 `git add .` 时遇到一堆 `warning: LF will be replaced by CRLF` 的提示。这是 Windows 的换行符问题——Git 的 `core.autocrlf` 配置会把 LF（`\n`）自动转成 CRLF（`\r\n`）。一般来说不影响功能，只是在跨平台协作时要注意统一换行符。
>
> 可以查看当前配置：
> ```bash
> git config core.autocrlf
> ```
> Windows 通常建议设为 `true`，Mac/Linux 建议设为 `input`。

## 3. 把不需要的文件从暂存区摘出来：`git restore --staged`

暂存区里混入了一些 AI 改动时生成的截图，比如 `screenshot-alignment.png` 这些。这些图不是项目代码，不应该提交。用下面命令把它们从暂存区移除：

```bash
git restore --staged screenshot-alignment.png screenshot-alignment2.png
```

再次 `git status` 后，这些截图从绿色变回了 `Untracked files`（红色/未跟踪），但文件仍然保留在本地，不会被提交。

## 4. 提交：`git commit`

第一次提交：

```bash
git commit -m "feat: add reference video templates"
```

提交后发现提交说明写得太简略，想补充中文说明。于是用 `git commit --amend` 修改最后一次提交：

```bash
git commit --amend -m "feat: add reference video templates 添加做同款功能和视频来源"
```

> ⚠️ `git commit --amend` **不是新建一个提交，而是改写最后一个提交**。如果只是本地还没推送，这样做完全没问题；但如果这个提交已经推送到远程，改写后哈希值会变，就需要 `git push --force` 才能同步，容易影响协作者，要慎用。

查看最后一次提交：

```bash
git log -1 --oneline
```

## 5. 推送：`git push`

```bash
git push origin feat/reference-video-templates
```

结果报错了：

```
File public/video-templates/YM17.mp4 is 195.36 MB
this exceeds GitHub's file size limit of 100.00 MB
```

GitHub 单个文件不能超过 **100 MB**。**Git 本身不是为存储大文件设计的**，视频、模型权重、大型数据集都不应该直接塞进仓库。

## 6. 把大视频从 Git 跟踪里移除：`git rm -r --cached`

执行：

```bash
git rm -r --cached public/video-templates
```

作用：把 `public/video-templates` 整个目录从 Git 索引中移除，但**保留本地文件**。再次 `git status` 后，这些视频就不再是待提交内容了。

然后用 `.gitignore` 告诉 Git 以后都忽略这些文件：

```gitignore
# Do not commit video files
*.mp4
**/*.mp4

# Temporary screenshots
screenshot-*.png
```

> 重要：`.gitignore` 只对**未跟踪**的文件生效。如果文件已经被提交到仓库里，光写 `.gitignore` 是不够的，必须先用 `git rm --cached` 移除跟踪。

## 7. 撤销上一次提交：`git reset --mixed HEAD~1`

因为上一次提交里包含了大文件，所以用：

```bash
git reset --mixed HEAD~1
```

`HEAD~1` 表示上一个提交。`--mixed` 的效果是：

- 撤销最后一次提交；
- 但保留那些改动的内容，把它们放回工作区（不进入暂存区）。

这样就可以重新整理要提交的内容，把大文件剔除后再重新提交。

三种 `git reset` 模式的区别：

| 命令 | 效果 |
|---|---|
| `git reset --soft HEAD~1` | 撤销提交，改动保留在暂存区 |
| `git reset --mixed HEAD~1` | 撤销提交，改动保留在工作区（默认） |
| `git reset --hard HEAD~1` | **撤销提交并删除改动，慎用！** |

## 8. 查看文件大小

在 Windows PowerShell 里检查某个文件是否超过 100MB：

```powershell
Get-Item public/video-templates/YM40.webm, public/video-templates/YM7 |
  Select-Object Name, @{Name="SizeMB"; Expression={[math]::Round($_.Length/1MB, 2)}}
```

也可以批量查看整个目录：

```bash
du -sh public/video-templates/*
```

## 9. 最终提交与推送

清理完大文件后，重新加入暂存区、提交、推送：

```bash
git add .
git commit -m "feat: add reference video templates 添加做同款功能和视频来源"
git push origin feat/reference-video-templates
```

这次成功推上去了。

## 10. 大文件该放哪？

视频、音频、模型权重这类大文件，应该放到专门的存储服务里，比如：

- Cloudflare R2
- AWS S3
- Backblaze B2
- 阿里云 OSS

项目里只保留它们的公开 URL，或者通过 API 动态获取。这样仓库体积可控，GitHub 也不会限制。

## 11. 补充：这次还没用到的常用 Git 命令

| 命令 | 作用 |
|---|---|
| `git diff` | 查看工作区与暂存区的差异 |
| `git diff --cached` | 查看暂存区与最后一次提交的差异 |
| `git restore <file>` | 丢弃工作区中某个文件的改动 |
| `git stash` / `git stash pop` | 临时保存/恢复改动 |
| `git branch` / `git branch -a` | 查看本地/远程分支 |
| `git checkout -b <branch>` | 新建并切换到新分支 |
| `git remote -v` | 查看远程仓库地址 |
| `git fetch` / `git pull` | 拉取远程更新 |
| `git log --oneline --graph` | 图形化查看提交历史 |
| `git show <commit>` | 查看某个提交的具体改动 |
| `git tag <name>` | 给某个提交打标签 |
| `git cherry-pick <commit>` | 把某个提交的改动应用到当前分支 |
| `git rebase -i HEAD~3` | 交互式整理最近 3 个提交 |
| `git clean -fd` | **删除所有未跟踪文件和目录，慎用！** |

## 总结

这次推送看到的几个关键点：

1. `git status` 红色是未暂存，绿色是已暂存。
2. `git add` 是把改动放进暂存区，`git restore --staged` 可以撤销暂存。
3. `git commit --amend` 用于修改最后一次提交说明，但会改写提交历史。
4. GitHub 单文件限制 100MB，大文件不能直接推仓库。
5. 用 `git rm -r --cached` + `.gitignore` 把大文件移出版本控制。
6. `git reset --mixed HEAD~1` 可以撤销提交但保留改动，方便重新整理。
7. 大文件应该放到对象存储（R2/S3 等），代码仓库只保留链接。
8. git restore --staged screenshot-alignment.png screenshot-alignment2.png（用于还未被跟踪的文件，直接从暂存区移到工作区就好了）
9. git rm -r --cached public/video-templates（用于已经被跟踪的文件，直接把它删掉，并且永不跟踪）

## 大概率下次这么做

```bash
# 1. 查看当前改动
# 红色 = 工作区未暂存，绿色 = 已暂存，Untracked = 未跟踪
git status

# 2. 如果 AI 过程截图被误 add 进了暂存区，把它们拿回到工作区
# 注意：如果截图本来就是 Untracked，这一步不需要执行
git restore --staged screenshot-alignment.png screenshot-alignment2.png

# 3. 确保 .gitignore 里已经写好了忽略规则
# public/video-templates/
# *.mp4
# **/*.mp4
# screenshot-*.png

# 4. 把已经被 Git 跟踪的大文件目录移出索引（解除跟踪）
# 如果目录本来就是 Untracked，这一步不需要执行
git rm -r --cached public/video-templates

# 5. 再次检查状态，确认大文件和截图都不再出现在待提交区域
git status

# 6. 提交所有改动（.gitignore 的更新也会被一起提交）
git add .
git commit -m "feat: add reference video templates 添加做同款功能和视频来源"

# 7. 推送到远程
git push origin feat/reference-video-templates
```

> ⚠️ 关键顺序：**`.gitignore` 必须先配好，再执行 `git rm -r --cached`，最后才能 `git add .`**。否则 `git add .` 会把刚刚解除跟踪的大文件又重新加回去。

提交前还可以顺手检查一下有没有文件超过 100MB：

```bash
# Windows PowerShell
Get-ChildItem public/video-templates -File |
  Select-Object Name, @{Name="SizeMB"; Expression={[math]::Round($_.Length/1MB,2)}} |
  Sort-Object SizeMB -Descending

# 或者 Git Bash / WSL
find public/video-templates -type f -size +90M
```

下一次遇到类似场景，应该会从容多了，最主要的是————AI再也不要在推送的时候刚好没额度了，虽然手动推送一下也不是不行