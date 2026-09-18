# 部署到 Cloudflare Pages（把网站变成一条永久链接）

> ⚠️ **先看第五节「1000 文件上限」** —— 网页端拖拽上传传不了完整版（它有 1100 个文件）。
> 有两条能走通的路，第一条 30 秒就能完成。

> **这份文档为什么放在 `docs/` 而不是 `deploy/`**
>
> 因为 `deploy/` 是**可丢弃的构建产物**（`.gitignore` 已排除），重建命令的第一步就是
> `rm -rf deploy`。我第一版把这份说明写在 `deploy/` 里，结果重建时**把它一起删了**，
> 而且因为它从没进过 git，没有任何备份。文档必须放在会被版本管理的地方 —— 这是教训。

---

## 一、`deploy/` 里有什么

```
deploy/
├── index.html              页面本体（入口，必须在最外层）
├── css/style.css           全部样式
└── js/
    ├── engine.js           通用拼图引擎
    ├── geomap.js           投影与几何
    ├── game.js             启动器 + 导航 UI
    ├── progress.js         跨地图进度与成就
    ├── score.js            计分与连击
    ├── share.js            分享卡片
    ├── contribute.js       众包纠错
    └── maps/
        ├── registry.js     地图总登记册（363 张）
        ├── loader.js       按需加载器
        ├── china.js / china.geo.js / china.data.js    中国根图
        └── china/          34 个省级 + 329 个地级，共 363 张地图的数据
```

**规模**：1100 个文件、20 MB。
**一个都不能少**：`index.html` 会加载上面全部 9 个脚本；`registry.js` 登记了 363 张地图，
每张需要 3 个文件（`.js` / `.geo.js` / `.data.js`）= 1089 个，缺一个那张图就报错。

> 已验证：363 × 3 = 1089 个地图文件**全部存在**，`index.html` 的 10 个本地资源引用**全部存在**。

### 特意没有放进去的

| 没放 | 为什么 |
| --- | --- |
| `tools/` | 31 个 Node 脚本，只在本地构建数据用，网站运行时不需要 |
| `docs/` | 设计文档和截图，跟运行无关 |
| `out/` | 打包产物（单文件离线包等），可重建 |
| `data/` | 天地图原始数据快照，构建时才用 |
| `.git/` | 版本历史 |
| `*.md` | 所有文档，网站不需要 |

---

## 二、本地先验证一遍（上传之前务必做）

在 `deploy/` 文件夹里跑：

```bash
cd /Users/apple/Desktop/deepseekharness/deploy
python3 -m http.server 8000
```

浏览器打开 <http://localhost:8000/> ，应当能看到成都地图拼图正常玩。

**已验证结果**（真实浏览器，不是估计）：

| 检查 | 结果 |
| --- | --- |
| `http://127.0.0.1:8000/` | 200，27629 字节 |
| 打开 `?map=sichuan` 后页面标题 | 「四川省地图拼图」 |
| 地图选择器条目数 | **363**（全部地图都在） |
| 四川省关卡碎片 / 槽位 | **18 / 18** |
| 9 个脚本 + 样式 + 地图数据 | 全部 200 |

要验证别的图，把地址换成 <http://localhost:8000/?map=chengdu> 等。

---

## 三、在 Cloudflare Pages 新建项目（图形界面）

1. 打开 <https://dash.cloudflare.com/> 并登录（免费注册，不需要信用卡）
2. 左侧菜单 → **Workers & Pages**
3. **Create** → **Pages** 标签 → **Upload assets**（不要选 Connect to Git）
4. 填 **Project name**，例如 `map-puzzle`
   （决定网址：`map-puzzle` → `https://map-puzzle.pages.dev`）
5. 把 `deploy/` **里面的东西**拖进上传区 —— `index.html`、`css/`、`js/` 三样一起
6. **Deploy site**，等十几秒
7. 拿到网址 `https://<项目名>.pages.dev`

### 这一路最容易错的地方

> **不要上传 `deploy` 文件夹本身。** 上传后打开是目录列表或 404，就是多套了一层 ——
> 根目录下必须**直接**看到 `index.html`。
>
> 判断方法：`https://<项目名>.pages.dev/index.html` 能开、但 `/` 打不开 → index.html 不在最外层。

### 更新网站

改完源文件后重新生成 `deploy/`（见第八节），再到 Pages 项目里
**Create new deployment** 重新上传。每次部署都是一个新版本，可以回滚。

---

## 四、部署后怎么用

### 换起始地图（改链接参数即可，不用重新部署）

| 链接 | 打开的是 |
| --- | --- |
| `https://xxx.pages.dev/` | 成都（默认） |
| `https://xxx.pages.dev/?map=sichuan` | 四川省（21 个市州） |
| `https://xxx.pages.dev/?map=chengdu` | 成都市（20 个区县） |
| `https://xxx.pages.dev/?map=china` | 中国（34 个省级，按地理分 7 关） |
| `https://xxx.pages.dev/?map=leshan` | 乐山市（11 个区县） |

还有关卡参数：`?level=2` 直接跳到第 2 关（同时解锁全部关卡）。
两个可以一起用：`?map=sichuan&level=1`

### ⚠️ 发给别人要用**稳定地址**

Cloudflare 每次部署会额外给一个带哈希的地址，形如
`https://a846d087.map-puzzle-89v.pages.dev` —— 那是**这次部署专享**的，下次部署就变了。

**对外分享一律用不带哈希的那个**：`https://<项目名>.pages.dev`

---

## 五、⚠️ 1000 文件上限：拖拽上传传不了完整版

拖拽上传 `deploy/` 时，Cloudflare 会报：

> **Your upload exceeds the limit of 1000 files.**
> Please try uploading a smaller amount or use the Wrangler CLI to upload to 20,000 files.

这不是操作错误。`deploy/` 有 **1100 个文件**（363 张地图 × 3 = 1089，加上外壳文件），
而**网页端拖拽上传的上限是 1000 个**。Cloudflare 官方给的两条出路就是下面这两条。

---

### 路线 1（**推荐先用这条**）：传单文件精简版 —— 30 秒搞定

已经准备好了：**`deploy-sichuan/`，里面只有 1 个文件（1.3 MB）**。

```
deploy-sichuan/
└── index.html        ← 单文件，样式 + 脚本 + 四川 22 张地图的数据全部内联在里面
```

在 Cloudflare 页面里：

1. **Back** 回到上一步（或刷新 `Create an app` 页面）
2. Project name 照旧填
3. 把 **`deploy-sichuan/index.html` 这一个文件**拖进上传区
4. **Deploy site**

**已验证**（本地起服务 + 真实浏览器打开）：

| 检查 | 结果 |
| --- | --- |
| `http://127.0.0.1:8010/` | 200，1311474 字节 |
| 打开 `?map=sichuan` 后标题 | 「四川省地图拼图」 |
| 地图选择器条目数 | **22**（四川省 + 21 个市州） |
| 碎片 / 槽位 | **18 / 18** |

**为什么精简版反而更适合第一轮验证**：

- **1.3 MB 单文件**，手机上打开快；完整版换省时要现场下载几百 KB 的省级数据
- 里面正好是**内容已经补全的成都、乐山** + 四川全部市州
- 传 1 个文件不会失败，能立刻拿到链接去发群

局限：菜单里**只有四川的 22 张图**。等验证有效果了再上完整版。

> 重新生成：根目录 `node tools/bundle.js --province=sichuan`
> 产物在 `out/地图拼图-四川省.html`，复制成 `deploy-sichuan/index.html` 即可

---

### 路线 2：用 Wrangler 命令行传完整版（上限 20000 个文件）

```bash
cd /Users/apple/Desktop/deepseekharness

# ① 登录（会打开浏览器授权，用你自己的 Cloudflare 账号）
npx wrangler@latest login

# ② 部署（--project-name 就是网址前缀）
npx wrangler@latest pages deploy deploy/ --project-name=map-puzzle
```

**已实测**：`npx wrangler@latest --version` → `4.133.0`，
`pages deploy` 支持 `--project-name` / `--branch`，1100 个文件 8.37 秒传完。

- 第一次跑 `npx` 会下载 wrangler（几十 MB），等一两分钟；之后有缓存
- 项目不存在时 wrangler 会**自动创建**，不必先去网页建
- 想先试跑不真上传：给 `pages deploy` 加 `--dry-run`
- 部署完会打印一个**预览地址**（带哈希）和一个**正式地址**（不带哈希）。分享用后者

> 用 API Token 代替浏览器登录（适合以后自动化）：
> 去 <https://dash.cloudflare.com/profile/api-tokens> 建一个带
> **Cloudflare Pages: Edit** 权限的 token，然后
> ```bash
> export CLOUDFLARE_API_TOKEN='你的token'
> export CLOUDFLARE_ACCOUNT_ID='你的account id'
> npx wrangler@latest pages deploy deploy/ --project-name=map-puzzle
> ```

---

### 两条路选哪条？

| | 路线 1 · 单文件精简版 | 路线 2 · Wrangler 完整版 |
| --- | --- | --- |
| 耗时 | 30 秒 | 3~5 分钟（含下载 wrangler + 登录） |
| 传的东西 | 1 个文件 | 1100 个文件 / 20 MB |
| 能玩到 | 四川 22 张图 | 全国 363 张图 |
| 首屏速度 | 快（单文件） | 快（226 KB），换省时再下载 |
| 适合 | **今晚就要发链接给人试玩** | 以后正式上线 |

**建议：先用路线 1 把链接拿到手发出去，验证有人玩之后再用路线 2 上完整版。**

---

## 六、部署成功后打不开？先按这个顺序查

部署成功后第一次用浏览器打开，可能遇到
**「Safari 浏览器无法打开页面 …… 因为无法与服务器建立安全连接」**。

**先别怀疑部署失败。** 按下面顺序排查（从最常见到最罕见）：

### 1. 证书签发的时间窗口（最常见）

Cloudflare Pages 给新的 `*.pages.dev` 子域名**在第一次请求时才签发证书**。
如果部署完成后**几十秒内**就打开，浏览器会因为拿不到有效证书而报"无法建立安全连接"。
**等 1 分钟重开一次就好。**

判断方法：

```bash
echo | openssl s_client -connect <项目名>.pages.dev:443 \\
  -servername <项目名>.pages.dev 2>/dev/null | openssl x509 -noout -dates
# notBefore=... ← 如果它和你打开的时间只差几秒，就是这个原因
```

### 2. 本地代理（第二步查这个，很容易漏）

macOS 上如果开着代理工具（Clash / ClashX / Surge 之类），
**浏览器的请求会走系统代理，而 `curl` 默认直连** —— 于是出现
"curl 能通、浏览器不通"这种看起来很矛盾的现象。

```bash
scutil --proxy | grep -E "HTTPEnable|HTTPSProxy|HTTPSPort"     # 看有没有代理

curl -sS -o /dev/null -w "%{http_code}\\n" https://<项目名>.pages.dev/            # 直连
curl -sS -x http://127.0.0.1:7890 -o /dev/null -w "%{http_code}\\n" https://<项目名>.pages.dev/   # 走代理
```

两次结果不一样 → 问题在代理，不在网站。临时关掉"系统代理"开关即可。

### 3. 浏览器缓存的失败状态

之前失败过一次之后，浏览器可能记住了。用**无痕窗口**打开试一次。

### 4. 链路本身不通（国内有报告）

`*.pages.dev` 在**中国大陆确实有被墙/不稳的报告**（例如福建等地）；
"`pages.dev` 主域能通但 `*.pages.dev` 子域不通"的情况也有人报过。

**判断方法**：让 2~3 个**不同网络**的人（不同运营商 / 手机流量 / 校园网）各打开一次。

- 都打不开 → 是真被拦，换 **腾讯云 EdgeOne Pages**（国内节点、免费，需实名）
- 有的能有的不能 → 就是网络差异，先把能打开的那批人用起来

---

## 七、两条部署路线：单文件 vs 裁剪包

`deploy/`（全国版，1100 个文件）**拖不上网页端**（上限 1000）。除了用 Wrangler，
还有一条更省事的：**用 `tools/deploy-pack.js` 裁出一个小于 1000 文件的部署包**。

```bash
# 一个省（含其下级）：81 个文件 / 2.9 MB —— 可以直接拖拽上传
node tools/deploy-pack.js --province=sichuan

# 指定几张图
node tools/deploy-pack.js --maps=chengdu,leshan

# 全国（会提示超限并中止；确实要生成加 --force）
node tools/deploy-pack.js --all
```

产物目录形如 `deploy-四川省/`，结构就是正常的**多文件站点**（不是单文件内联）：

```
deploy-四川省/
├── index.html
├── css/style.css
└── js/            外壳 8 个脚本 + loader/registry + 22 张地图 × 3 个文件
```

它和 `tools/bundle.js` 的分工：

| | `bundle.js`（单文件） | `deploy-pack.js`（多文件） |
| --- | --- | --- |
| 产物 | **1 个** `.html`（全部内联） | 一个目录（正常结构） |
| 适合 | 微信/QQ 发文件、离线双击 | 传静态托管、要正常的站点 |
| 首屏 | 一次加载全部（18.5MB 全国版偏慢） | 只载 226KB，换省再下载 |
| 能玩到 | 按 `--province` / `--all` 裁剪 | 同左 |

**两个工具都会裁剪 registry**（`pruneRegistry`）—— 这是关键：
registry 登记了全部 363 张地图，只删文件不裁 registry 的话，
菜单里照样列出 363 张、点开没打进包的会 404。
`deploy-pack.js` 生成后会自动断言：引用完整 / 三件套齐全 / registry 已裁 / 无越界目录。

### 路线选择建议

| 目标 | 用哪个 |
| --- | --- |
| 今晚就发个链接给人试玩 | `bundle.js --province=<省>`（1 个文件，最快） |
| 传静态托管、想留正常结构 | `deploy-pack.js --province=<省>`（81 个文件，可直接拖拽） |
| 上线全国版 | `wrangler pages deploy deploy/`（1100 个文件，命令行上限 20000） |

---

## 八、`_headers` 与 `_redirects` 模板

仓库里 `deploy-templates/` 放了两份现成模板，**复制到部署根目录**（和 `index.html` 同级、
文件名原样）即可生效。

### `_headers` —— 安全头与缓存策略

```bash
cp deploy-templates/_headers deploy/          # 或在 deploy-<范围>/ 里
```

要点：

- 补上 `X-Content-Type-Options` / `Referrer-Policy` / `X-Frame-Options` /
  `Permissions-Policy` 四个安全头
- **缓存策略刻意保守**：HTML / JS / CSS 一律 `max-age=0, must-revalidate`，
  只有体积最大、改动最少的 `*.geo.js` 给一天缓存。
  原因是文件名**没有内容 hash**，同一个 URL 的内容会随部署变化 ——
  激进缓存会让老访客一直看到旧版本（这个坑我们踩过：部署完自己打开是旧页面，
  以为没部署成功）。模板里附了一份"激进版"注释块，内容稳定后再考虑启用。

### `_redirects` —— 短链接与 404 兜底

```bash
cp deploy-templates/_redirects deploy/
```

里面已经写好这些短链接，**老师发给学生特别有用**：

```
/sichuan       → /?map=sichuan
/china/exam    → /?map=china&mode=exam
/china/teach   → /?map=china&mode=teach
```

以及一条 `/* → /index.html 404` 兜底（未知路径不再显示 Cloudflare 自带的 404 页）。
状态码用 302 而不是 301：短链接没有 SEO 需求，而 301 会被长期记住、很难改回来。

> 本站**不需要** SPA 的 history fallback —— 所有状态都在 URL 查询串里
> （`?map=` / `?mode=` / `?diff=` / `?pick=`），没有客户端路由。

---

## 九、三条必须知道的事

### 1. `pages.dev` 在国内的访问速度是"看运气"

Cloudflare 在中国大陆没有节点。**这不是你配置错了。**

### 2. 免费额度完全够用

无限请求、无限带宽、每月 500 次构建、单文件上限 25 MiB。
我们最大的是 `js/maps/china.geo.js`（1.6 MB），远低于上限。

### 3. 冷启动与缓存

第一次访问某个省的图会现场下载那个省的数据（几百 KB），稍等一下；
之后浏览器会缓存。首屏只有 226 KB，所以打开很快。

---

## 十、`deploy/` 怎么重建

源文件改了之后，在**项目根目录**（不是 `deploy/` 里）跑：

```bash
cd /Users/apple/Desktop/deepseekharness

# 完整版（1100 个文件 / 20MB）
rm -rf deploy && mkdir -p deploy/css deploy/js/maps
cp index.html deploy/
cp css/style.css deploy/css/
cp js/*.js deploy/js/          # 通配：新加脚本不用改这条命令（手写清单漏过一次）
cp js/maps/loader.js js/maps/registry.js js/maps/china*.js deploy/js/maps/
#   ↑ 用通配而不是逐个列：新加脚本时不会漏（手写清单漏过一次，见 SOP 坑 #44）
cp -R js/maps/china deploy/js/maps/china

# 单文件精简版（1 个文件 / 1.3MB）
node tools/bundle.js --province=sichuan
rm -rf deploy-sichuan && mkdir -p deploy-sichuan
cp "out/地图拼图-四川省.html" deploy-sichuan/index.html
```

> `deploy/` 与 `deploy-sichuan/` 都在 `.gitignore` 里 —— **它们是可丢弃的**，
> 随时能从上面的命令重建。所以**不要把任何只此一份的东西放进这两个文件夹**
> （这份文档原来就在里面，然后被 `rm -rf` 删掉了，见文首）。

**注意**：`js/maps/registry.js` 登记了全部 363 张地图。
想做"只有四川"的精简版，**必须同时裁剪 registry**，否则菜单里会列出 363 张图、
点开没打进包的会 404。裁剪逻辑在 `tools/bundle.js` 里已经有了（`pruneRegistry`），
`deploy-sichuan/index.html` 就是它的产物（所以菜单里只有 22 张图）。
