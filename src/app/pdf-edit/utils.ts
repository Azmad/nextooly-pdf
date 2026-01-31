export const getPathBounds = (paths: { x: number; y: number }[]) => {
  if (!paths || paths.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  paths.forEach(p => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });

  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
};

export const getFontClass = (fontName?: string) => {
  if (fontName === "Times Roman") return "font-times";
  if (fontName === "Courier") return "font-courier";
  if (fontName === "Roboto") return "font-roboto";
  if (fontName === "Open Sans") return "font-opensans";
  if (fontName === "Lato") return "font-lato";
  if (fontName === "Montserrat") return "font-montserrat";
  if (fontName === "Oswald") return "font-oswald";
  if (fontName === "Playfair Display") return "font-playfair";
  return "font-helvetica";
};

export const removeWhiteBackground = (dataUrl: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const threshold = 210;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (r > threshold && g > threshold && b > threshold) {
          data[i + 3] = 0;
        }
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = dataUrl;
  });
};
