# 专注时钟 · FocusFlow

一个**纯静态**的番茄工作法计时器 + 任务清单：开箱即用、免登录、无后端，数据全部保存在浏览器本地。
可直接部署到 GitHub Pages 公开访问。

## 功能

- **番茄钟**：专注 / 短休息 / 长休息三种模式，可自定义时长与长休间隔
- **环形进度**：SVG 圆环显示剩余进度，标签页标题同步显示倒计时
- **任务清单**：添加、选中、完成、删除任务；专注时长自动累计到当前任务
- **统计**：今日专注分钟数、今日番茄数、累计专注时长、连续专注天数、最近 7 天柱状图
- **提醒**：结束提示音（Web Audio 合成，无需音频文件）+ 可选桌面通知
- **快捷键**：`空格` 开始 / 暂停，`R` 重置
- **明暗主题**，偏好本地记忆
- **零网络请求**：所有逻辑在本地运行，不依赖任何接口

## 本地预览

直接双击 `index.html` 即可；或启动本地服务器：

```bash
python -m http.server 8080
# 或者
npx serve .
```

访问 http://localhost:8080

## 部署到 GitHub Pages

### 方式一：网页上传（不需要安装 Git）

1. 打开 https://github.com/new ，仓库名填 `focus-flow`，可见性选 **Public**，点 Create repository；
2. 在仓库页面点 **Add file → Upload files**，把 `index.html`、`assets/` 文件夹、`README.md`、`.nojekyll` 一起拖进去（保持 `assets` 目录结构），点 **Commit changes**；
3. 进入仓库 **Settings → Pages**，Source 选 **Deploy from a branch**，Branch 选 `main` + `/ (root)`，点 Save；
4. 等 1～2 分钟，访问：

   **https://<你的GitHub用户名>.github.io/focus-flow/**

### 方式二：命令行（需要先安装 Git）

```bash
cd focus-flow
git init -b main
git add .
git commit -m "feat: 专注时钟静态站"
git remote add origin https://github.com/<你的用户名>/focus-flow.git
git push -u origin main
```

推送完成后在 **Settings → Pages** 开启 `main` 分支部署即可。

## 目录结构

```
focus-flow/
├─ index.html          # 页面结构
├─ assets/
│  ├─ style.css        # 样式（含明暗主题）
│  └─ app.js           # 计时器、任务、统计逻辑
├─ .nojekyll           # 跳过 GitHub Pages 的 Jekyll 处理
└─ README.md
```

## 数据说明

- 任务、统计、配置、主题均保存在浏览器 `localStorage`（键名前缀 `ff.`）；
- 换浏览器或清理浏览器数据后记录会丢失，属预期行为；
- 页面不采集、不上传任何信息。

MIT License
