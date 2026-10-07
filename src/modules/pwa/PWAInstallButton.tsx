import React, { useState } from 'react';
import { Download, Smartphone, X, Check, Laptop } from 'lucide-react';
import { usePWAInstall } from './usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // If already running as an installed PWA
  if (isInstalled) {
    return (
      <span
        title="Application installée en mode autonome PWA"
        className="hidden xl:inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300"
      >
        <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
        PWA Active
      </span>
    );
  }

  // Desktop / Android / Chrome / Edge native install prompt
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors whitespace-nowrap"
        title="Installer IvoireAppro ERP sur votre appareil"
      >
        <Download className="h-3.5 w-3.5" />
        <span>Installer l'App</span>
      </button>
    );
  }

  // In other environments or iOS, offer guided instructions modal
  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750 transition-colors whitespace-nowrap"
        title="Installer IvoireAppro ERP (PWA)"
      >
        {isIOS ? (
          <Smartphone className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        )}
        <span className="hidden sm:inline">Installer PWA</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  {isIOS ? <Smartphone className="h-5 w-5" /> : <Laptop className="h-5 w-5" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold">Installer l'application PWA</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">IvoireAppro ERP Hors-ligne</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-slate-600 dark:text-slate-300">
              {isIOS ? (
                <>
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      1
                    </span>
                    <p>
                      Dans Safari, appuyez sur l'icône de <strong>Partage</strong> (rectangle avec flèche vers le haut).
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      2
                    </span>
                    <p>
                      Sélectionnez <strong>« Sur l'écran d'accueil »</strong> dans la liste.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      3
                    </span>
                    <p>
                      Appuyez sur <strong>Ajouter</strong> pour l'utiliser comme une application native.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      1
                    </span>
                    <p>
                      Sur Google Chrome ou Microsoft Edge, cliquez sur l'icône <strong>Installer l'application</strong> située tout à droite de la barre d'adresse.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      2
                    </span>
                    <p>
                      Ou ouvrez le menu du navigateur (les 3 points en haut à droite) et choisissez <strong>« Installer IvoireAppro ERP »</strong>.
                    </p>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full rounded-lg bg-slate-900 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </>
  );
};
