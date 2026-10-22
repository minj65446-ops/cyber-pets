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

### 4. 发布／更新微信小程序

小程序与网页是**两套代码**：这里是 HTML + DOM，`mp.weixin.qq.com` 的小程序要 WXML／WXSS／`app.json`，不能直接转换移植，也不需要你自己打开微信开发者工具上传。

要走小程序：在 WorkBuddy 打开「代码开发」，新建应用时选择**小程序**类型，把玩法需求（可直接说「照着 cyber-pets 的赛博江湖做」）丢进去重新生成一份原生小程序工程；随后扫码绑定微信账号（体验小程序无需 AppID），上传、提交审核、发布全部在 WorkBuddy 应用空间内完成。

网页版的玩法如果不打算改，可以用作小程序里 `<web-view>` 加载的目标 —— 但那需要**你自己已备案的域名**并在微信后台配置业务域名，托管临时域名不满足要求。

## 内容与合规

收录人物**均为虚构形象**：人名做了同音换字处理，地名、平台名、金额一律虚构化或模糊化，数值与技能为娱乐化设定。不含任何真实个人信息，不指向、不代表、不评价任何真实个人，非商业用途。

## 免责说明

娱乐向个人作品，代码以「能跑起来」为第一优先级，不做工程化保证。
