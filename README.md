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

## 内容与合规

收录人物**均为虚构形象**：人名做了同音换字处理，地名、平台名、金额一律虚构化或模糊化，数值与技能为娱乐化设定。不含任何真实个人信息，不指向、不代表、不评价任何真实个人，非商业用途。

## 免责说明

娱乐向个人作品，代码以「能跑起来」为第一优先级，不做工程化保证。
