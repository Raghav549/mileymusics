export const isInAppBrowser = () => {
  const userAgent = window.navigator.userAgent;
  return (
    userAgent.includes('Instagram') ||
    userAgent.includes('FBAN') ||
    userAgent.includes('FBAV')
  );
};

export const share = async (title, text, url) => {
  try {
    if (navigator.share) {
      await navigator.share({
        title,
        text,
        url,
      });
    } else {
      // Fallback: copy to clipboard
      const shareUrl = `${url}?share=${encodeURIComponent(title)}`;
      await navigator.clipboard.writeText(shareUrl);
      alert('Link copied to clipboard!');
    }
  } catch (error) {
    console.error('Share error:', error);
    throw error;
  }
};
