# offline-material-ledger

车间里工具和耗材被临时借走是常事，纸本子和 Excel 记久了总对不上账。
这个工具只管一件事：谁借走了什么、什么时候还的。

一个 HTML 文件，双击就能用。不用联网，不用安装，没有后台，
数据就存在本机浏览器的 localStorage 里。

[中文](#中文) · [English](#english)

![主界面](test/shots/02-main.png)

## 中文

### 用法

打开页面，在最上面的输入框打一句话：

    张三借了2个M6螺丝

点「解析」，弹个确认框，看一眼没问题点「确认写入」就记上了。

名字没打全（「小张」）、只记得别名（「扳手」）、中文数字（「三把」）它都认。
拿不准的时候会把最像的几个列出来让你点，不会自己默默猜一个写进去。

台账和库存的搜索框是模糊的，打错一两个字也能找到——「罗丝」能搜到 M6螺丝。
完全对上的排前面，只是相近的排后面，带个灰色的「相近」标记，不用自己分辨哪个是猜的。

![模糊查找](test/shots/10-fuzzy-search.png)

键盘快捷键：`/` 跳到输入框，`1~5` 切页，`Esc` 关弹窗。窄屏下表格自动变卡片。

### 记得备份

数据只存在本机，换电脑、清缓存、重装浏览器都会没。顶栏会提醒「已 N 天未备份」，
去「数据管理」导出 JSON 存一份。多人同时记账做不了，这是单机版。

给库管看的说明（不含技术内容）在 [使用说明.txt](使用说明.txt)。

### 构建

    node src/build.js          # 把 src/ 合并成单文件 物料借还管理.html

改完 src/ 重新跑一次就行。测试：

    node test/core.test.js     # 147 项单元测试
    node test/syntax.js        # 产物体检
    node test/browser.js       # 无头浏览器截图，需要本机 Edge
    node test/probe.js         # 模糊查找的 DOM 探针，量数值不看截图

只有 Node 一个依赖，没有 npm install 这一步。

core.js 是纯函数、不碰 DOM，所以单测不用起浏览器。库存增减只能走
applyBorrow / applyReturn / applyStockIn / applyStockSet 这四个函数，
界面层不要直接改 item.stock——账目规则都锁在里面。

### 分支

`main` 是开源版，不带任何商标；`internal` 是内部版，多一个图标。
商标图放在 `brand/`，只在 internal 分支提交，所以切分支时这个目录时有时无，正常现象。

Fork 之后请把 `brand/` 换成你自己的资源。

## English

A ledger for workshop tools and consumables: who took what, and when it came back.
One HTML file, double-click to open. No network, no install, no backend —
records live in the browser's localStorage.

Type a sentence like `张三借了2个M6螺丝` ("Zhang San took 2 M6 screws"),
confirm it, done. It understands nicknames (小张 → 张三), aliases (扳手 → 活动扳手),
Chinese numerals, and full-width input. When it isn't sure, it shows the closest
candidates and lets you pick, rather than guessing.

Search is fuzzy on both the ledger and stock pages: misspellings still match
(罗丝 finds M6螺丝), exact matches rank first, and near matches are tagged
so you can tell them apart.

Keyboard shortcuts: `/` focuses the input, `1~5` switches pages, `Esc` closes dialogs.
Tables collapse into cards on narrow screens.

### Backup

Data never leaves the machine. Export a JSON backup from the data page —
the header nags you when it has been too long. This is a single-machine tool;
simultaneous multi-user editing is out of scope.

### Build

    node src/build.js          # merge src/ into the single-file 物料借还管理.html
    node test/core.test.js     # 147 unit tests
    node test/syntax.js        # sanity checks on the built file
    node test/probe.js         # DOM probe for fuzzy search, needs local Edge

Node is the only dependency, nothing to install. `src/core.js` is pure and DOM-free,
so unit tests run without a browser. Stock changes must go through
applyBorrow / applyReturn / applyStockIn / applyStockSet — the UI never touches
item.stock directly.

### Branches

`main` is the open-source build with no branding. `internal` adds a logo under
`brand/` and inlines it into the built file. If you fork this repo, replace
`brand/` with your own assets.

## License

[MIT](LICENSE)
