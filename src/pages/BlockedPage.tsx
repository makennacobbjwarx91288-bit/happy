import { ShieldAlert } from "lucide-react";
import { useShop } from "@/context/ShopContext";

const BlockedPage = () => {
  const { blockedAction } = useShop();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 px-4">
      <div className="max-w-md w-full text-center space-y-6 p-8 rounded-lg border bg-card shadow-sm">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-semibold">访问受限</h1>
        <p className="text-muted-foreground">
          {blockedAction === "captcha"
            ? "根据安全策略，当前网络或设备暂无法访问，请稍后再试或更换网络。"
            : blockedAction === "redirect"
              ? "您已被重定向至安全提示页。"
              : "当前无法访问本页面。"}
        </p>
      </div>
    </div>
  );
};

export default BlockedPage;
