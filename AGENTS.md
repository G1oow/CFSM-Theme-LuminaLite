# AGENTS.md

本仓库的协作约定。与全局 `~/.pi/agent/AGENTS.md` 一起生效；冲突时以站长当前指令为准。

## 只通过 PR 合并

- **不要直接向 `main` 提交或推送。** 任何代码、样式、文案、文档改动都先开分支，推送后开 PR，由站长合并。
- 分支从最新的 `main` 切出，命名沿用现有习惯：`feat/<slug>`、`fix/<slug>`、`chore/<slug>`、`docs/<slug>`。
- 允许：`git switch -c <branch>`、`git add`、`git commit`、`git push origin <branch>`、`gh pr create`、`gh pr view`、`gh pr checks`。
- 不允许：`git push origin main`、在 `main` 上直接 `git commit` 后推送、`git push --force`、删除远端分支、改写远端历史。
- 合并由站长在 GitHub 上完成；合并后 `.github/workflows/build-theme.yml` 会把 `main` 构建进 `dist`，线上主题才更新。

## PR 内容

- 说明改了什么、为什么改、影响范围；附上实际执行的验证（命令与结果），未执行的检查要写清。
- 发版按既定约定一起进 PR：先改 `package.json` 的 `version`，再在 `CHANGELOG.md` 顶部加一段（首行会被 CI 取出来当产物提交说明）。
- 涉及首页布局、配色、交互等视觉改动，先在对话里给预览确认，再进 PR。

## 其他

- 提交信息用中文 Conventional Commits。
- 工作区里已有的未提交改动属于站长，不要回退或覆盖。
