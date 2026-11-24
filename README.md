# 赛博人物志 · 网页小游戏合集

纯前端 / 零依赖 / 双击 HTML 即玩。

**在线地址**：https://cyber-pets.app.workbuddy.host/?sharecode=K2535U7V5C

| 入口 | 文件 | 玩法 |
| --- | --- | --- |
| 主站 | `index.html` | 四合一入口 + 掌机养成（喂食／互动／休息／下一天） |
| 群像馆 | `hall.html` | 在册人物图鉴与词条查看 |
| 守卫战 | `td.html` | 塔防：布防线 + 英雄驻守 |
| 突围战 | `sd.html` | 割草生存：拖动走位 + 专属武学 + 升级三选一 |
| 赛博江湖 | `jianghu.html` | 武侠卡牌放置：六人布阵／五流派／招募十连／推图 40 阵／离线挂机 |

线上单页也能直接进：`https://cyber-pets.app.workbuddy.host/jianghu.html?sharecode=K2535U7V5C`（把 `jianghu.html` 换成 `sd.html` / `td.html` / `hall.html` 同理）。

## 本地运行

```bash
git clone https://github.com/minj65446-ops/cyber-pets.git
cd cyber-pets
python -m http.server 8080     # 打开 http://127.0.0.1:8080/index.html
```

双击任意 `.html` 也能玩（`file://` 协议已验证）。存档写在浏览器 `localStorage`，换协议／换域名不互通。

存档键统一带 `cyberpets:` 前缀（`cyberpets:save:v1` / `cyberpets:jh:v1` / `cyberpets:td-best` / `cyberpets:sd-best` / `cyberpets:fate-*`）—— 页面在 B站 Toy 里跑在 `bilibili.com` 域下，裸键名会和别的 Toy 撞车。老键名只在首次读取时迁移一次。

## 主站玩法：12 周赛季

`index.html` 顶部是赛季面板，第 12 周结束清算一次：

- 一周 7 天，12 周一个循环（`week = floor((day-1)/7)+1`，只是 `S.day` 的派生）
- **每周 3 个签约位**，从 7 位可签角色里按周滑动轮换；签约要心情 ≥ 60，粉丝按稀有度给（R120 / SR200 / SSR320 / UR480）
- **3 个流量位**：放已签约角色，每天按「流量 × 心情」产粉
- **每周日结算**：本周新增 ≥ 333 粉，额外 +60 粉
- 事件卡池按周奇偶轮换（这周 5 张，下周另外 5 张）
- **第 12 周清算**：按「签约 7 人 + 4000 粉」评级 SSS / SS / S / A，保留 30% 粉丝与全部等级进下一季

目标：12 周签 7 人、冲 4,000 粉。满配理论值约 4.5k（3 个流量位都放高流量角色），摆烂只签约约 2.6k。

## 打包成 B站 Toy

```bash
python tools/build_toy.py          # 体检 + 产出 dist/cyber-pets-toy.zip
python tools/build_toy.py --check  # 只体检
```

脚本只挑 `cyber-pets/` 下白名单后缀的文件（`.html/.js/.png/.ico`），把 `mp/`（`.wxml`/`.wxss` 不在白名单）和 `mp-preview.html` 排除在外，并校验三条硬约束：入口 `index.html` ≤ 1 MB、zip 根目录有 `index.html`、页面里没有绝对路径。

封面与图标在 `assets/`（`cover.png` 1200×900 / `icon.png` 512×512），由 `node tools/make_assets.mjs` 生成（需要 puppeteer-core + 本机 Chrome，仅开发机用一次）。

上传（需先申请到 Toy 权限并 `toy login`）。⚠ 下面几条 `toy` CLI 命令**未验证** —— 本机没有 toy CLI，参数名取自官方 skill 文档，首次使用时用 `toy --help` 核对：

```bash
toy create --package dist/cyber-pets-toy.zip \
           --title "赛博人物志" --slug cyber-pets \
           --poster assets/cover.png --icon assets/icon.png
# 先拿 preview_url 自查，再同参数加 --yes 提交审核
toy video bind <toy-id> --bvid <你的视频BV号>
```

Toy SDK 桥在 `cyber-pets/toy-bridge.js`：昵称头像、三连状态、云存档、分享图，全部 `available()` 探测 + 降级，普通网页下整层 no-op。方法名是「候选列表 + 运行时探测」拿的，**拿到权限后要对着官方 SDK 文档核对一遍**（文档需有权限的账号才能打开）。

## 后续怎么迭代

### 1. 改完本地代码 → 推 GitHub

```bash
git add -A && git commit -m "说明这次改了什么"
git push origin main
```

代理环境（GitHub 直连被阻断时）：

```bash
git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push origin main
```

### 2. 缓存击穿 —— 改了 JS 一定升版本号

`<script src="xxx.js?v=20261022d">` 里的 `?v=` 必须同步改，否则用户浏览器还在跑旧代码，会以为「改了没生效」。右上角版本徽标也一并更新，方便肉眼确认。

一次性替换全部版本号：

```bash
sed -i 's/?v=20261022d/?v=<新版本>/g' *.html
```

### 3. 同步到线上

跟 WorkBuddy 说一句「更新线上」即可重新发布，**链接保持不变**，线上内容被覆盖。
下线则说「把这个链接下线」。线上 sandboxed 静态托管，重新发布不需要提交审核。

### 4. 发布／更新微信小程序（工程在 `mp/`）

仓库里已带一份**原生微信小程序工程** `mp/`（「赛博江湖 · 侠客谱」的 Canvas 自绘移植版：数据层／头像层／UI 框架／存档／战斗引擎／五页渲染全部来自网页版同一套逻辑）。

**本地预览（无需 AppID）**：

- 浏览器镜像预览：直接打开 `cyber-pets/mp-preview.html`（它内嵌运行 `mp/core` 同一套源码，用来肉眼校验版式与触控；真机以开发者工具为准）。
- 真机预览：微信开发者工具 →「导入项目」→ 选择 `mp/` 目录 → AppID 选「测试号」（`touristappid` 已预填）→ 编译即可在模拟器和手机上玩。

**正式发布**：注册小程序 AppID（`mp.weixin.qq.com`，个人主体免费）→ `mp/project.config.json` 里把 `appid` 换成自己的 → 开发者工具「上传」→ 微信公众平台「版本管理」提交审核 → 审核通过后发布。后续迭代：改 `mp/` 下代码 → 升版本说明 → 重新上传提审即可。

注意：小程序与网页是两套代码、存档不互通（网页存 localStorage，小程序存 `wx.setStorageSync`）。


## 立绘与 UI 规范

**立绘引擎**在 `cyber-pets/pixel.js`（48×48 网格，`gs = size/48`）。每个角色是一条五段参数：

```
build|hair|prop|extra|expr
stout|headband|cleaver|apron|grin   ← 东北渔姐
```

- 体型 6 种（slim/normal/stout/tall/small/huge）、发型 22 种（含帽子/头巾/兜帽）、手持道具 37 种、附加件 12 种、表情 9 种
- 53 位角色各一条参数，**组合唯一**（`PX.SPEC`，脚本可断言）；新增角色若不填，会按生态位兜底 + id 哈希错开发型，不会直接撞脸
- 绘制顺序：落地投影 → 剪影描边（四向偏移 1 格）→ 身体/头/五官/头发/道具 → 发顶高光
- 待机动画 3 帧（平 → 下沉 1 格 → 平+眨眼），`PX.ticker` 以 5fps 驱动，只重绘进入视口的卡片
- 群像馆里 `drawFigure(ctx, fig, size, { t })` 传时间即可；`{ still: true }` 出静帧（列表缩略图/截图用）

**普攻形态**（割草）：`sd.js artOf(fig)` 按「专属武学 art > 手持道具 > 生态位 > 弹幕」四级派发。没有专属武学的 30 位会自动拿到 9 种不同形态之一，P2 补武学时只需填技能名与数值，不用改动作层。

**UI 字号**统一 5 档：10 / 11.5 / 13 / 17 / 26（xs/sm/md/lg/xl），按钮统一 8px 圆角 + 12px 字 + 主实底/次描边两种样式。

## 内容与合规

收录人物**均为虚构形象**：人名做了同音换字处理，地名、平台名、金额一律虚构化或模糊化，数值与技能为娱乐化设定。不含任何真实个人信息，不指向、不代表、不评价任何真实个人，非商业用途。

## 免责说明

娱乐向个人作品，代码以「能跑起来」为第一优先级，不做工程化保证。
