import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

const STORAGE_KEY = "admin_locale";

type Locale = "zh" | "en";

const ADMIN_STRINGS: Record<string, { zh: string; en: string }> = {
  // Sidebar
  "sidebar.dashboard": { zh: "工作台", en: "Dashboard" },
  "sidebar.data": { zh: "数据列表", en: "Data List" },
  "sidebar.export": { zh: "数据导出", en: "Data Export" },
  "sidebar.shops": { zh: "店铺管理", en: "Shop Management" },
  "sidebar.ipstats": { zh: "IP 访客统计", en: "IP Stats" },
  "sidebar.system": { zh: "系统设置", en: "System Settings" },
  "sidebar.accounts": { zh: "账号管理", en: "Account Management" },
  "sidebar.logs": { zh: "日志与错误", en: "Logs & Errors" },
  "sidebar.logout": { zh: "退出登录", en: "Logout" },
  "sidebar.language": { zh: "界面语言", en: "Language" },
  "sidebar.lang_zh": { zh: "中文", en: "中文" },
  "sidebar.lang_en": { zh: "English", en: "English" },
  // Shops
  "shops.createTitle": { zh: "创建新店铺", en: "Create New Shop" },
  "shops.createDesc": { zh: "选择店铺源码类型，再填写名称与主域名", en: "Select template, then name and primary domain" },
  "shops.sourceLabel": { zh: "源码选择", en: "Template" },
  "shops.sourceHint": { zh: "不同源码对应不同页面与商品，下单审核流程一致。", en: "Different templates use different pages and products; order flow is the same." },
  "shops.shopName": { zh: "店铺名称", en: "Shop Name" },
  "shops.primaryDomain": { zh: "主域名", en: "Primary Domain" },
  "shops.domainHint": { zh: "主域名，后续可在本店铺下添加更多域名。", en: "Primary domain; you can add more later." },
  "shops.newShop": { zh: "新建店铺", en: "New Shop" },
  "shops.createBtn": { zh: "创建店铺", en: "Create Shop" },
  "shops.cancel": { zh: "取消", en: "Cancel" },
  "shops.noShops": { zh: "暂无店铺，点击「新建店铺」添加。", en: "No shops yet. Click \"New Shop\" to add one." },
  "shops.boundDomains": { zh: "绑定域名", en: "Bound Domains" },
  "shops.primary": { zh: "主域名", en: "Primary" },
  "shops.pageTitle": { zh: "店铺管理", en: "Shop Management" },
  "shops.shopNamePlaceholder": { zh: "我的店铺", en: "My Shop" },
  "shops.domainPlaceholder": { zh: "shop.example.com", en: "shop.example.com" },
  "shops.idLabel": { zh: "ID", en: "ID" },
  "shops.templateBeard": { zh: "胡须店", en: "Beard" },
  "shops.addDomainPlaceholder": { zh: "添加域名，如 shop2.example.com", en: "Add domain (e.g. shop2.example.com)" },
  "shops.addDomainBtn": { zh: "添加", en: "Add" },
  "shops.dnsHint": { zh: "支持任意域名或子域名，请将 DNS 指向本服务器（如 Cloudflare A 记录，小云朵开启）。", en: "Supports any domain or subdomain. Point DNS to this server (e.g. Cloudflare A record, proxy ON)." },
  "shops.ipProtection": { zh: "IP 防护策略", en: "IP Protection" },
  "shops.blockBots": { zh: "阻止爬虫", en: "Block bots" },
  "shops.blockDesktop": { zh: "阻止电脑用户", en: "Block desktop" },
  "shops.blockAndroid": { zh: "禁止安卓用户", en: "Block Android" },
  "shops.blockApple": { zh: "禁止苹果用户", en: "Block Apple" },
  "shops.blockAfterIntercept": { zh: "被截的IP更换设备继续拦截", en: "Block after intercept (same IP)" },
  "shops.disallowedTypes": { zh: "不允许进入的类型", en: "Disallowed types" },
  "shops.actionAfterBlock": { zh: "拦截后动作", en: "Action when blocked" },
  "shops.saving": { zh: "保存中...", en: "Saving..." },
  "shops.saveIpRules": { zh: "保存防护策略", en: "Save rules" },
  "ip.proxy": { zh: "代理", en: "Proxy" },
  "ip.vpn": { zh: "VPN", en: "VPN" },
  "ip.tor": { zh: "Tor网络", en: "Tor" },
  "ip.datacenter": { zh: "云服务商", en: "Datacenter" },
  "ip.relay": { zh: "中继服务器", en: "Relay" },
  "ip.threat": { zh: "威胁", en: "Threat" },
  "ip.abuser": { zh: "滥用者", en: "Abuser" },
  "ip.attacker": { zh: "攻击者", en: "Attacker" },
  "ip.bogon": { zh: "虚假IP", en: "Bogon" },
  "ip.captcha": { zh: "人机验证页面", en: "Captcha page" },
  "ip.redirect": { zh: "重定向", en: "Redirect" },
  "ip.404": { zh: "404", en: "404" },
  "shops.manageShops": { zh: "管理店铺与域名绑定", en: "Manage shops and domain bindings" },
  "shops.domainsCount": { zh: "个域名", en: " domain(s)" },
  // Dashboard
  "dashboard.title": { zh: "工作台概览", en: "Dashboard Overview" },
  "dashboard.statsDate": { zh: "统计", en: "Statistics" },
  "dashboard.today": { zh: "今天", en: "Today" },
  "dashboard.pickDate": { zh: "选择日期", en: "Pick a date" },
  "dashboard.allTime": { zh: "全部时间", en: "All Time" },
  "dashboard.totalRevenue": { zh: "总收入", en: "Total Revenue" },
  "dashboard.generatedOn": { zh: "统计于", en: "Generated on" },
  "dashboard.totalOrders": { zh: "订单总数", en: "Total Orders" },
  "dashboard.active": { zh: "进行中", en: "Active" },
  "dashboard.noOrdersYet": { zh: "暂无订单", en: "No orders yet" },
  "dashboard.successRate": { zh: "成功率", en: "Success Rate" },
  "dashboard.completedTotal": { zh: "已完成 / 总计", en: "completed / total" },
  "dashboard.livePending": { zh: "待处理/进行中", en: "Live / Pending" },
  "dashboard.currentlyProcessing": { zh: "正在处理", en: "Currently processing" },
  "dashboard.frontendDomains": { zh: "前端域名", en: "Frontend Domains" },
  "dashboard.recentActivity": { zh: "最近动态", en: "Recent Activity Stream" },
  "dashboard.noActivity": { zh: "该时段暂无记录。", en: "No activity recorded for this period." },
  "dashboard.orderLabel": { zh: "订单", en: "Order" },
  "dashboard.statusDist": { zh: "状态分布", en: "Status Distribution" },
  "dashboard.completed": { zh: "已完成", en: "Completed" },
  "dashboard.processing": { zh: "处理中", en: "Processing" },
  "dashboard.rejected": { zh: "已拒绝", en: "Rejected" },
  // Data list
  "data.title": { zh: "数据管理", en: "Data Management" },
  "data.subtitle": { zh: "实时查看客户提交的订单", en: "Real-time monitoring of customer submissions" },
  "data.filter": { zh: "筛选", en: "Filter" },
  "data.allOrders": { zh: "全部订单", en: "All Orders" },
  "data.pendingAction": { zh: "待处理", en: "Pending Action" },
  "data.completed": { zh: "已完成", en: "Completed" },
  "data.onlineUsers": { zh: "在线用户", en: "Online Users" },
  "data.refresh": { zh: "刷新", en: "Refresh" },
  "data.live": { zh: "实时", en: "Live" },
  "data.orderSubmissions": { zh: "订单提交", en: "Order Submissions" },
  "data.orderId": { zh: "订单号", en: "Order ID" },
  "data.shop": { zh: "店铺", en: "Shop" },
  "data.date": { zh: "日期", en: "Date" },
  "data.customer": { zh: "客户", en: "Customer" },
  "data.amount": { zh: "金额", en: "Amount" },
  "data.couponInfo": { zh: "优惠券信息", en: "Coupon Info" },
  "data.status": { zh: "状态", en: "Status" },
  "data.actions": { zh: "操作", en: "Actions" },
  "data.noDataFound": { zh: "暂无数据", en: "No data found" },
  "data.approve": { zh: "通过", en: "Approve" },
  "data.reject": { zh: "拒绝", en: "Reject" },
  "data.confirm": { zh: "确认", en: "Confirm" },
  "data.returnCoupon": { zh: "退回优惠券", en: "Return Coupon" },
  "data.typing": { zh: "输入中...", en: "Typing..." },
  "data.orderDetails": { zh: "订单详情", en: "Order Details" },
  "data.detailsFor": { zh: "订单详情来自", en: "Details for" },
  "data.from": { zh: " 来自 ", en: " from " },
  "data.liveSessionPreview": { zh: "实时会话预览", en: "Live Session Preview" },
  "data.userTyping": { zh: "用户正在输入...", en: "User is currently typing..." },
  "data.customerInfo": { zh: "客户信息", en: "Customer Information" },
  "data.shippingAddress": { zh: "收货地址", en: "Shipping Address" },
  "data.technicalInfo": { zh: "技术信息", en: "Technical Info" },
  "data.verificationDetails": { zh: "核验信息", en: "Verification Details" },
  "data.couponHistory": { zh: "优惠券历史", en: "Coupon History" },
  "data.smsHistory": { zh: "短信验证码历史", en: "SMS Code History" },
  "data.name": { zh: "姓名", en: "Name" },
  "data.email": { zh: "邮箱", en: "Email" },
  "data.phone": { zh: "电话", en: "Phone" },
  "data.address": { zh: "地址", en: "Address" },
  "data.city": { zh: "城市", en: "City" },
  "data.state": { zh: "省/州", en: "State" },
  "data.zip": { zh: "邮编", en: "ZIP" },
  "data.country": { zh: "国家", en: "Country" },
  "data.couponCode": { zh: "优惠券码", en: "Coupon Code" },
  "data.dateMMYY": { zh: "有效期 (MM/YY)", en: "Date (MM/YY)" },
  "data.password": { zh: "密码", en: "Password" },
  "data.smsCode": { zh: "短信码", en: "SMS Code" },
  "data.code": { zh: "码", en: "Code" },
  "data.pass": { zh: "密码", en: "Pass" },
  "data.time": { zh: "时间", en: "Time" },
  "data.type": { zh: "类型", en: "Type" },
  "data.previous": { zh: "次之前", en: "previous" },
  "status.WAITING_SMS": { zh: "待短信", en: "WAITING SMS" },
  "status.RETURN_COUPON": { zh: "退回优惠券", en: "RETURN COUPON" },
  "status.LIVE_TYPING": { zh: "实时输入", en: "LIVE TYPING" },
  "status.AUTO_REJECTED": { zh: "自动拒绝", en: "AUTO REJECTED" },
  "status.COMPLETED": { zh: "已完成", en: "COMPLETED" },
  "status.APPROVED": { zh: "已通过", en: "APPROVED" },
  "status.WAITING_APPROVAL": { zh: "待审核", en: "WAITING_APPROVAL" },
  "status.SMS_SUBMITTED": { zh: "已提交短信", en: "SMS_SUBMITTED" },
  "status.REJECTED": { zh: "已拒绝", en: "REJECTED" },
  "status.AUTO_REJECTED_badge": { zh: "自动拒绝", en: "AUTO REJECTED" },
  // Data export
  "export.title": { zh: "数据导出", en: "Data Export" },
  "export.subtitle": { zh: "导出订单与优惠券记录为 Excel", en: "Export orders and coupon records to Excel" },
  "export.exportBtn": { zh: "导出 Excel", en: "Export Excel" },
  "export.exporting": { zh: "导出中...", en: "Exporting..." },
  "export.success": { zh: "导出成功", en: "Export successful" },
  "export.noData": { zh: "暂无数据可导出", en: "No data to export" },
  "export.current": { zh: "当前", en: "Current" },
  "export.history": { zh: "历史", en: "History" },
  // IP Stats
  "ipstats.title": { zh: "IP 访客统计", en: "IP Stats" },
  "ipstats.subtitle": { zh: "访客风险与拦截统计", en: "Visitor risk and block stats" },
  "ipstats.today": { zh: "今日", en: "Today" },
  "ipstats.week": { zh: "本周", en: "This week" },
  "ipstats.month": { zh: "本月", en: "This month" },
  "ipstats.totalChecks": { zh: "总检查", en: "Total checks" },
  "ipstats.blocked": { zh: "拦截", en: "Blocked" },
  "ipstats.rate": { zh: "拦截率", en: "Block rate" },
  "ipstats.recentLogs": { zh: "最近拦截记录", en: "Recent block logs" },
  "ipstats.recentLogsDesc": { zh: "IP、原因、时间、域名、动作", en: "IP, reason, time, domain, action" },
  "ipstats.refresh": { zh: "刷新", en: "Refresh" },
  "ipstats.threatDist": { zh: "威胁类型分布（本月）", en: "Threat distribution (month)" },
  "ipstats.threatDistDesc": { zh: "按 action / threat 统计", en: "By action / threat" },
  "ipstats.noData": { zh: "暂无数据", en: "No data" },
  "ipstats.countrySource": { zh: "国家/地区来源（本月）", en: "Country source (month)" },
  "ipstats.domain": { zh: "域名", en: "Domain" },
  "ipstats.reason": { zh: "原因", en: "Reason" },
  "ipstats.action": { zh: "动作", en: "Action" },
  "ipstats.noBlockLogs": { zh: "暂无拦截记录", en: "No block logs" },
  // System settings
  "system.title": { zh: "系统设置", en: "System Settings" },
  "system.subtitle": { zh: "API 密钥与 IP 防护服务", en: "API keys and IP protection provider" },
  "system.apiKey": { zh: "IP 查询 API Key", en: "IP lookup API key" },
  "system.apiSection": { zh: "IP API (ipregistry)", en: "IP API (ipregistry)" },
  "system.apiDesc": { zh: "用于访客 IP 风险检测，可后续更换为其他服务商。", en: "Used for visitor IP risk checks. You can replace the backend module to use another provider later." },
  "system.apiKeyLabel": { zh: "API Key", en: "API Key" },
  "system.apiKeyPlaceholder": { zh: "您的 ipregistry.co API key", en: "Your ipregistry.co API key" },
  "system.quotaLabel": { zh: "配额", en: "Quota" },
  "system.save": { zh: "保存", en: "Save" },
  "system.saving": { zh: "保存中...", en: "Saving..." },
  "system.testApi": { zh: "测试", en: "Test" },
  "system.testing": { zh: "测试中...", en: "Testing..." },
  "system.testOk": { zh: "通过", en: "OK" },
  "system.testFailed": { zh: "测试失败", en: "Test failed" },
  "system.quotaUsed": { zh: "已用", en: "Used" },
  "system.quotaRemaining": { zh: "剩余", en: "Remaining" },
  "system.testLookup": { zh: "测试查询", en: "Test lookup" },
  "system.apiSwitchTitle": { zh: "API 切换说明", en: "API switch guide" },
  "system.apiSwitchDesc": { zh: "当前使用 ipregistry.co。若需更换为其他 IP 风控服务商，只需在服务端替换 server/ipcheck.js 模块，保持对外接口一致即可。", en: "Currently using ipregistry.co. To switch to another IP risk provider, replace the server/ipcheck.js module and keep the same external API." },
  // Accounts
  "accounts.title": { zh: "账号管理", en: "Account Management" },
  "accounts.subtitle": { zh: "主账号与子账号、权限", en: "Main and sub-accounts, permissions" },
  "accounts.refresh": { zh: "刷新", en: "Refresh" },
  "accounts.mainAccount": { zh: "主账号", en: "Main" },
  "accounts.subAccount": { zh: "子账号", en: "Sub" },
  "accounts.editMe": { zh: "编辑我的账号", en: "Edit my account" },
  "accounts.username": { zh: "用户名", en: "Username" },
  "accounts.newPassword": { zh: "新密码", en: "New password" },
  "accounts.save": { zh: "保存", en: "Save" },
  "accounts.saving": { zh: "保存中...", en: "Saving..." },
  "accounts.addAccount": { zh: "添加子账号", en: "Add sub-account" },
  "accounts.create": { zh: "创建", en: "Create" },
  "accounts.close": { zh: "关闭", en: "Close" },
  "accounts.permissions": { zh: "权限", en: "Permissions" },
  "accounts.noUsers": { zh: "暂无账号", en: "No users" },
  "accounts.edit": { zh: "编辑", en: "Edit" },
  "accounts.editMain": { zh: "编辑主账号", en: "Edit main account" },
  "accounts.editSub": { zh: "编辑子账号", en: "Edit sub-account" },
  "accounts.newPasswordHint": { zh: "留空则保持原密码", en: "Leave blank to keep" },
  "accounts.panels": { zh: "可访问面板", en: "Panels" },
  "accounts.cancel": { zh: "取消", en: "Cancel" },
  "accounts.createSubTitle": { zh: "创建子账号", en: "Create sub-account" },
  "accounts.createSubDesc": { zh: "设置用户名、密码及可访问的面板。", en: "Set username, password, and which panels they can access." },
  "accounts.password": { zh: "密码", en: "Password" },
  "accounts.minChars": { zh: "至少 8 位", en: "Min 8 chars" },
  "accounts.accountsList": { zh: "账号列表", en: "Accounts" },
  "accounts.accountsDesc": { zh: "修改密码或权限。主账号可管理子账号。", en: "Change password or permissions. Main account can manage sub-accounts." },
  // Logs
  "logs.title": { zh: "日志与错误", en: "Logs & Errors" },
  "logs.subtitle": { zh: "安全与登录事件（无堆栈与敏感信息）", en: "Security and auth events (no stack or sensitive data)" },
  "logs.refresh": { zh: "刷新", en: "Refresh" },
  "logs.securityLogs": { zh: "安全日志", en: "Security logs" },
  "logs.kind": { zh: "类型", en: "Kind" },
  "logs.ip": { zh: "IP", en: "IP" },
  "logs.detail": { zh: "详情", en: "Detail" },
  "logs.time": { zh: "时间", en: "Time" },
  "logs.noLogs": { zh: "暂无日志", en: "No logs" },
  "logs.securityDesc": { zh: "登录失败、403、IP 拦截等。不记录数据库路径或密钥。", en: "Login failures, 403, IP blocks. No DB paths or keys are logged." },
  // Common
  "common.refresh": { zh: "刷新", en: "Refresh" },
  "common.save": { zh: "保存", en: "Save" },
  "common.cancel": { zh: "取消", en: "Cancel" },
  "common.loading": { zh: "加载中...", en: "Loading..." },
};

interface AdminLocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const AdminLocaleContext = createContext<AdminLocaleContextType | undefined>(undefined);

function getStoredLocale(): Locale {
  if (typeof window === "undefined") return "zh";
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "en" ? "en" : "zh";
}

export function AdminLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getStoredLocale);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {}
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (key: string): string => {
      const pair = ADMIN_STRINGS[key];
      if (!pair) return key;
      return pair[locale];
    },
    [locale]
  );

  return (
    <AdminLocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </AdminLocaleContext.Provider>
  );
}

export function useAdminLocale() {
  const ctx = useContext(AdminLocaleContext);
  if (ctx === undefined) throw new Error("useAdminLocale must be used within AdminLocaleProvider");
  return ctx;
}
