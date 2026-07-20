export const brandingHidden = () => false;
export const brandingKnown = () => true;

let brandingChangeCallback = null;

export const onBrandingChange = (callback) => {
  brandingChangeCallback = callback;
};

export const refreshBranding = async () => {
  if (brandingChangeCallback) {
    brandingChangeCallback({
      hidden: false,
      known: true,
    });
  }
};
