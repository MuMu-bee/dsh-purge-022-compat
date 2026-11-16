# 推送通道备注 / push transport note

2026-11-16：本机到 `github.com` 的 HTTPS 与 SSH 通道均被网络重置（`api.github.com` 与 `codeload.github.com` 正常），
因此脱敏提交（去掉本机路径的那次改动）是通过 **GitHub Contents API** 逐文件落到远端的，远端产生了 6 个独立提交。

远端 head 的 tree 与本地 `5b86f55` 的 tree 完全相同（`f79579ade278e2dce746bdf1f2ffa4d0ee66f8c6`），
即**内容一致、提交历史不同步**。等 `github.com:443` 恢复后，先执行：

```powershell
git fetch origin
git reset --hard origin/main
```

即可把本地历史与远端对齐，之后正常 `commit` / `push`。
