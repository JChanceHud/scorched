const fs = require('fs')
const path = require('path')

const scorchedArtifactPath = path.join(__dirname, '../artifacts/contracts/Scorched.sol/Scorched.json')
const scorchedMarketArtifactPath = path.join(__dirname, '../artifacts/contracts/ScorchedMarket.sol/ScorchedMarket.json')
const multiAssetArtifactPath = path.join(__dirname, '../artifacts/@statechannels/nitro-protocol/contracts/NitroAdjudicator.sol/NitroAdjudicator.json')

{
  const { abi } = require(scorchedArtifactPath)
  fs.writeFileSync(path.join(__dirname, '../src/ScorchedABI.json'), JSON.stringify(abi, null, 2))
}
{
  const { abi } = require(scorchedMarketArtifactPath)
  fs.writeFileSync(path.join(__dirname, '../src/ScorchedMarketABI.json'), JSON.stringify(abi, null, 2))
}
{
  const { abi } = require(multiAssetArtifactPath)
  fs.writeFileSync(path.join(__dirname, '../src/AdjudicatorABI.json'), JSON.stringify(abi, null, 2))
}
