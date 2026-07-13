import { memo, useEffect, useState } from 'react';
import { useTheme } from 'antd-style';

// External font stylesheets for Hero typewriter rotation.
// Loaded dynamically on mount to avoid blocking first paint.
const FONT_STYLESHEETS = [
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Ma+Shan+Zheng&family=Marck+Script&display=swap',
  'https://fontsapi.zeoseven.com/256/main/result.css',
  'https://fontsapi.zeoseven.com/292/main/result.css',
  'https://fontsapi.zeoseven.com/790/main/result.css',
  'https://fontsapi.zeoseven.com/119/main/result.css',
  'https://fontsapi.zeoseven.com/236/main/result.css',
  'https://fontsapi.zeoseven.com/118/main/result.css',
];

// Track loaded URLs to prevent duplicate <link> injection across remounts.
const loadedFontUrls = new Set<string>();

const MESSAGES = [
  '落笔成章，今日开工。',
  '文章千古事，得失寸心知。',
  '方块世界，论文先行。',
  '논문을 완성해 봅시다.',
  '书于竹帛，传之其人。',
  '千里の道も一歩から。',
  'Une idée, un papier, une vie.',
  'Write. Revise. Publish.',
  'Наука есть свет.',
];

// Each message gets its own font style — cycling through 9 distinct styles
const FONTS = [
  '"Huiwen-mincho", serif',
  '"LXGW WenKai", "霞鹜文楷", cursive',
  '"BoutiqueBitmap9x9 3D", monospace',
  '"CEF Fonts CJK", sans-serif',
  '"峄山碑篆体", "YiShanBeiZhuanTi", serif',
  '"チョーク体", cursive',
  '"ZSFT-j", serif',
  '"Playfair Display", serif',
  '"Marck Script", cursive',
];

const TYPE_SPEED = 100;
const ERASE_SPEED = 50;
const PAUSE_AFTER_TYPE = 1800;
const PAUSE_AFTER_ERASE = 400;

function HeroComp(): React.ReactElement {
  const theme = useTheme();
  const [msgIndex, setMsgIndex] = useState(0);
  const [typed, setTyped] = useState('');
  const [phase, setPhase] = useState<'typing' | 'pausing' | 'erasing' | 'waiting'>('typing');

  // Inject external font stylesheets on mount; clean up on unmount.
  useEffect(() => {
    const addedUrls: string[] = [];
    const links: HTMLLinkElement[] = [];
    for (const url of FONT_STYLESHEETS) {
      if (loadedFontUrls.has(url)) continue;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      document.head.appendChild(link);
      loadedFontUrls.add(url);
      addedUrls.push(url);
      links.push(link);
    }
    return () => {
      links.forEach((l) => l.remove());
      addedUrls.forEach((u) => loadedFontUrls.delete(u));
    };
  }, []);

  useEffect(() => {
    const current = MESSAGES[msgIndex];
    let timer: ReturnType<typeof setTimeout>;

    if (phase === 'typing') {
      if (typed.length < current.length) {
        timer = setTimeout(() => setTyped(current.slice(0, typed.length + 1)), TYPE_SPEED);
      } else {
        timer = setTimeout(() => setPhase('pausing'), PAUSE_AFTER_TYPE);
      }
    } else if (phase === 'pausing') {
      timer = setTimeout(() => setPhase('erasing'), 0);
    } else if (phase === 'erasing') {
      if (typed.length > 0) {
        timer = setTimeout(() => setTyped(typed.slice(0, -1)), ERASE_SPEED);
      } else {
        setPhase('waiting');
      }
    } else {
      // waiting — move to next message
      timer = setTimeout(() => {
        setMsgIndex((i) => (i + 1) % MESSAGES.length);
        setPhase('typing');
      }, PAUSE_AFTER_ERASE);
    }

    return () => clearTimeout(timer);
  }, [typed, phase, msgIndex]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 200,
        padding: '48px 24px',
      }}
    >
      <h1
        key={msgIndex}
        style={{
          fontSize: 40,
          fontWeight: 700,
          color: theme.colorText,
          margin: 0,
          lineHeight: 1.5,
          fontFamily: FONTS[msgIndex % FONTS.length],
          transition: 'font-family 0.3s ease',
          textAlign: 'center',
        }}
      >
        {typed}
        <span className="hero-cursor">|</span>
      </h1>
    </div>
  );
}

export const Hero = memo(HeroComp);
