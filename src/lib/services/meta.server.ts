type MetaAdAccount = {
  id: string;
  name: string | null;
  accountStatus: string | null;
};

export class MetaAdsService {
  private readonly appId = process.env.META_APP_ID;
  private readonly appSecret = process.env.META_APP_SECRET;
  private readonly redirectUri = process.env.META_REDIRECT_URI;

  private assertConfigured() {
    if (!this.appId || !this.appSecret || !this.redirectUri) {
      throw new Error(
        "Meta OAuth is not configured. Set META_APP_ID, META_APP_SECRET and META_REDIRECT_URI on the server.",
      );
    }
  }

  getAuthorizationUrl(state: string) {
    this.assertConfigured();

    const params = new URLSearchParams({
      client_id: this.appId!,
      redirect_uri: this.redirectUri!,
      state,
      response_type: "code",
      scope: "ads_management,ads_read",
    });

    return `https://www.facebook.com dialog/oauth?${params.toString()}`.replace(
      "facebook.com dialog",
      "facebook.com",
    );
  }

  async connectAccount(): Promise<never> {
    this.assertConfigured();
    throw new Error(
      "Meta OAuth callback must be implemented in a server route before enabling account connection.",
    );
  }

  async getAdAccounts(): Promise<MetaAdAccount[]> {
    this.assertConfigured();
    throw new Error("Meta ad account discovery is not enabled yet.");
  }

  async getCampaigns(): Promise<never> {
    this.assertConfigured();
    throw new Error("Meta campaign discovery is not enabled yet.");
  }

  async createCampaign(): Promise<never> {
    this.assertConfigured();
    throw new Error("Campaign publishing requires the official Meta API callback flow.");
  }

  async createAdSet(): Promise<never> {
    this.assertConfigured();
    throw new Error("Ad set publishing is not enabled yet.");
  }

  async createAd(): Promise<never> {
    this.assertConfigured();
    throw new Error("Ad publishing is not enabled yet.");
  }

  async pauseCampaign(): Promise<never> {
    this.assertConfigured();
    throw new Error("Campaign controls are not enabled yet.");
  }

  async activateCampaign(): Promise<never> {
    this.assertConfigured();
    throw new Error("Campaign controls are not enabled yet.");
  }

  async getCampaignInsights(): Promise<never> {
    this.assertConfigured();
    throw new Error("Campaign insights are not enabled yet.");
  }
}