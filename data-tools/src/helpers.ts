export function getYouTubeId(url: string): string {
  // eslint-disable-next-line no-useless-escape
  const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  return match ? match[1] : 'unknown';
}