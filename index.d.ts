declare module 'scorched' {
  function createOutcome(
    balances: { [key: string]: any },
    assetHolderAddress: string
  ): {
    asset: string,
    assetHolderAddress: string,
    allocationItems: any
  }

  function parseAppData(data: string): {
    payment: string,
    suggesterBurn: string,
    askerBurn: string,
    queryStatus: number,
    responseStatus: number,
    status: number,
  }

  function decodeAppData(data: string): (number|string)[][]
  function encodeAppData(data: {
    payment: string,
    askerBurn: string,
    suggesterBurn: string,
    status: number,
    queryStatus: number,
    responseStatus: number,
  }): string

  enum AppStatus {
    Negotiate,
    Answer,
    Validate,
  }

  enum QueryStatus {
    None,
    Accepted,
    Declined,
  }

  enum ResponseStatus {
    None,
    Pay,
    Burn,
  }

  const ScorchedABI: any
  const AdjudicatorABI: any
  const ScorchedMarketABI: any
}
