import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, Share, Smartphone, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const InstallPage = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua));
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setInstalled(true));

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setDeferredPrompt(null);
  };

  if (isStandalone || installed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-sm w-full">
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
            <h1 className="text-2xl font-bold font-heading">Already Installed!</h1>
            <p className="text-muted-foreground">NovaTrack is installed on your device. You're all set.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="max-w-sm w-full">
        <CardContent className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <Smartphone className="h-12 w-12 text-primary mx-auto" />
            <h1 className="text-2xl font-bold font-heading">Install NovaTrack</h1>
            <p className="text-sm text-muted-foreground">
              Add NovaTrack to your home screen for quick access, offline support, and a native app experience.
            </p>
          </div>

          {deferredPrompt ? (
            <Button onClick={handleInstall} className="w-full gap-2" size="lg">
              <Download className="h-5 w-5" />
              Install App
            </Button>
          ) : isIOS ? (
            <div className="space-y-3 rounded-lg bg-muted/50 p-4">
              <p className="text-sm font-medium">To install on iOS:</p>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-foreground">1.</span>
                  Tap the <Share className="inline h-4 w-4 text-primary" /> Share button in Safari
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-foreground">2.</span>
                  Scroll down and tap <strong>"Add to Home Screen"</strong>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-foreground">3.</span>
                  Tap <strong>"Add"</strong> to confirm
                </li>
              </ol>
            </div>
          ) : (
            <div className="space-y-3 rounded-lg bg-muted/50 p-4">
              <p className="text-sm font-medium">To install:</p>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-foreground">1.</span>
                  Open the browser menu (⋮)
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-foreground">2.</span>
                  Tap <strong>"Install app"</strong> or <strong>"Add to Home Screen"</strong>
                </li>
              </ol>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'Offline', desc: 'Works without wifi' },
              { label: 'Fast', desc: 'Instant loading' },
              { label: 'Native', desc: 'Home screen icon' },
            ].map(f => (
              <div key={f.label} className="space-y-1">
                <p className="text-sm font-medium">{f.label}</p>
                <p className="text-[10px] text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InstallPage;
