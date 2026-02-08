import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useAdminLocale } from "@/context/AdminLocaleContext";
import { API_URL } from "@/lib/constants";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, LayoutTemplate, Image as ImageIcon, Plus, Trash2, ShoppingBag, AlignJustify } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface Shop {
  id: number;
  name: string;
  domain: string;
  layout_config: string | null; // JSON string from DB
}

interface HeroConfig {
  title?: string;
  subtitle?: string;
  backgroundImage?: string;
  ctaText?: string;
  ctaLink?: string;
}

interface HeaderConfig {
  announcementText?: string;
  announcementEnabled?: boolean;
  navLinks?: { label: string; href: string }[];
}

interface ProductGridConfig {
  sectionTitle?: string;
  itemsPerPage?: number;
}

interface LayoutConfig {
  hero?: HeroConfig;
  header?: HeaderConfig;
  productGrid?: ProductGridConfig;
}

export const ShopDesignView = () => {
  const { getAuthHeaders, clearAuth } = useAdminAuth();
  const { t } = useAdminLocale();
  const { toast } = useToast();
  
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form State
  const [heroConfig, setHeroConfig] = useState<HeroConfig>({});
  const [headerConfig, setHeaderConfig] = useState<HeaderConfig>({ 
    announcementEnabled: true,
    announcementText: "Norse Winter Beard Oil Available Now",
    navLinks: [
      { label: "Shop", href: "/shop" },
      { label: "Deals", href: "/deals" },
      { label: "Beard", href: "/category/beard" },
    ]
  });
  const [productGridConfig, setProductGridConfig] = useState<ProductGridConfig>({
    sectionTitle: "The Collection",
    itemsPerPage: 8
  });

  // Load all shops
  useEffect(() => {
    fetch(`${API_URL}/api/admin/shops`, { headers: getAuthHeaders() })
      .then(res => {
        if (res.status === 401) { clearAuth(); return []; }
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setShops(data);
          if (data.length > 0) {
            setSelectedShopId(String(data[0].id));
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [getAuthHeaders, clearAuth]);

  // Load config when shop selection changes
  useEffect(() => {
    if (!selectedShopId) return;
    const shop = shops.find(s => String(s.id) === selectedShopId);
    if (shop && shop.layout_config) {
      try {
        const parsed = JSON.parse(shop.layout_config) as LayoutConfig;
        setHeroConfig(parsed.hero || {});
        if (parsed.header) setHeaderConfig(prev => ({ ...prev, ...parsed.header }));
        if (parsed.productGrid) setProductGridConfig(prev => ({ ...prev, ...parsed.productGrid }));
      } catch (e) {
        console.error("Failed to parse layout config", e);
      }
    } else {
      // Reset to defaults if no config
      setHeroConfig({});
      setHeaderConfig({ 
        announcementEnabled: true,
        announcementText: "Norse Winter Beard Oil Available Now",
        navLinks: [
          { label: "Shop", href: "/shop" },
          { label: "Deals", href: "/deals" },
          { label: "Beard", href: "/category/beard" },
        ]
      });
      setProductGridConfig({ sectionTitle: "The Collection", itemsPerPage: 8 });
    }
  }, [selectedShopId, shops]);

  const handleSave = async () => {
    if (!selectedShopId) return;
    setSaving(true);
    
    const newLayoutConfig: LayoutConfig = {
      hero: heroConfig,
      header: headerConfig,
      productGrid: productGridConfig
    };

    try {
      const res = await fetch(`${API_URL}/api/admin/shops/${selectedShopId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          layout_config: newLayoutConfig
        })
      });

      if (res.ok) {
        toast({ title: "Saved", description: "Shop layout updated successfully." });
        // Update local state
        setShops(prev => prev.map(s => {
          if (String(s.id) === selectedShopId) {
            return { ...s, layout_config: JSON.stringify(newLayoutConfig) };
          }
          return s;
        }));
      } else {
        throw new Error("Failed to save");
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to save layout.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Shop Design</h2>
          <p className="text-muted-foreground text-sm">Customize your shop's look and feel.</p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={selectedShopId} onValueChange={setSelectedShopId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select Shop" />
            </SelectTrigger>
            <SelectContent>
              {shops.map(s => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>

      <Tabs defaultValue="header" className="w-full">
        <TabsList>
          <TabsTrigger value="header" className="flex items-center gap-2"><AlignJustify className="w-4 h-4" /> Header</TabsTrigger>
          <TabsTrigger value="hero" className="flex items-center gap-2"><LayoutTemplate className="w-4 h-4" /> Hero Section</TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-2"><ShoppingBag className="w-4 h-4" /> Products</TabsTrigger>
        </TabsList>

        <TabsContent value="header" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Announcement Bar</CardTitle>
              <CardDescription>Top bar for announcements and deals.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch 
                  id="announce-mode" 
                  checked={headerConfig.announcementEnabled}
                  onCheckedChange={(c) => setHeaderConfig(prev => ({ ...prev, announcementEnabled: c }))}
                />
                <Label htmlFor="announce-mode">Enable Announcement Bar</Label>
              </div>
              {headerConfig.announcementEnabled && (
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Input 
                    value={headerConfig.announcementText || ""} 
                    onChange={e => setHeaderConfig(prev => ({ ...prev, announcementText: e.target.value }))}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Navigation</CardTitle>
              <CardDescription>Main menu links.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {headerConfig.navLinks?.map((link, idx) => (
                <div key={idx} className="flex gap-2 items-end">
                  <div className="space-y-1 flex-1">
                    <Label className="text-xs">Label</Label>
                    <Input 
                      value={link.label} 
                      onChange={e => {
                        const newLinks = [...(headerConfig.navLinks || [])];
                        newLinks[idx].label = e.target.value;
                        setHeaderConfig(prev => ({ ...prev, navLinks: newLinks }));
                      }}
                    />
                  </div>
                  <div className="space-y-1 flex-1">
                    <Label className="text-xs">URL</Label>
                    <Input 
                      value={link.href} 
                      onChange={e => {
                        const newLinks = [...(headerConfig.navLinks || [])];
                        newLinks[idx].href = e.target.value;
                        setHeaderConfig(prev => ({ ...prev, navLinks: newLinks }));
                      }}
                    />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => {
                     const newLinks = [...(headerConfig.navLinks || [])];
                     newLinks.splice(idx, 1);
                     setHeaderConfig(prev => ({ ...prev, navLinks: newLinks }));
                  }}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => {
                setHeaderConfig(prev => ({ ...prev, navLinks: [...(prev.navLinks || []), { label: "New Link", href: "/" }] }))
              }}>
                <Plus className="w-4 h-4 mr-2" /> Add Link
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hero" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Content</CardTitle>
                <CardDescription>Main text and calls to action.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Headline Title</Label>
                  <Input 
                    value={heroConfig.title || ""} 
                    onChange={e => setHeroConfig(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Keep on Growing"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Subtitle</Label>
                  <Input 
                    value={heroConfig.subtitle || ""} 
                    onChange={e => setHeroConfig(prev => ({ ...prev, subtitle: e.target.value }))}
                    placeholder="e.g. Premium beard care products"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Button Text</Label>
                    <Input 
                      value={heroConfig.ctaText || ""} 
                      onChange={e => setHeroConfig(prev => ({ ...prev, ctaText: e.target.value }))}
                      placeholder="e.g. Shop Now"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Button Link</Label>
                    <Input 
                      value={heroConfig.ctaLink || ""} 
                      onChange={e => setHeroConfig(prev => ({ ...prev, ctaLink: e.target.value }))}
                      placeholder="e.g. /shop"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Visuals</CardTitle>
                <CardDescription>Background images and style.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Background Image URL</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={heroConfig.backgroundImage || ""} 
                      onChange={e => setHeroConfig(prev => ({ ...prev, backgroundImage: e.target.value }))}
                      placeholder="https://example.com/hero.jpg"
                    />
                    <Button variant="outline" size="icon">
                      <ImageIcon className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Recommended size: 1920x1080px</p>
                </div>
                
                {/* Preview Thumbnail */}
                {heroConfig.backgroundImage && (
                  <div className="mt-4 aspect-video rounded-md overflow-hidden border bg-muted relative">
                    <img 
                      src={heroConfig.backgroundImage} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="text-center text-white p-4">
                        <p className="text-xl font-bold font-serif">{heroConfig.title || "Title"}</p>
                        <p className="text-sm mt-1 opacity-90">{heroConfig.subtitle || "Subtitle"}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="products" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Product Grid Settings</CardTitle>
              <CardDescription>Configure how products are displayed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Section Title</Label>
                <Input 
                  value={productGridConfig.sectionTitle || ""} 
                  onChange={e => setProductGridConfig(prev => ({ ...prev, sectionTitle: e.target.value }))}
                  placeholder="e.g. The Collection"
                />
              </div>
              <div className="space-y-2">
                <Label>Items Per Page</Label>
                <Select 
                  value={String(productGridConfig.itemsPerPage || 8)} 
                  onValueChange={v => setProductGridConfig(prev => ({ ...prev, itemsPerPage: parseInt(v) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">4 Items</SelectItem>
                    <SelectItem value="8">8 Items</SelectItem>
                    <SelectItem value="12">12 Items</SelectItem>
                    <SelectItem value="16">16 Items</SelectItem>
                    <SelectItem value="24">24 Items</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
