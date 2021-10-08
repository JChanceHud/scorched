async function main() {
  const [ deployer ] = await ethers.getSigners()

  console.log(`Deploying from ${deployer.address}`)

  const NitroAdjudicator = await ethers.getContractFactory('NitroAdjudicator')
  const adjudicator = await NitroAdjudicator.deploy()
  await adjudicator.deployed()

  const Scorched = await ethers.getContractFactory('Scorched')
  const scorched = await Scorched.deploy(adjudicator.address)
  await scorched.deployed()

  const ScorchedMarket = await ethers.getContractFactory('ScorchedMarket')
  const scorchedMarket = await ScorchedMarket.deploy()
  await scorchedMarket.deployed()

  console.log(`NitroAdjudicator address: ${adjudicator.address}`)
  console.log(`Scorched address: ${scorched.address}`)
  console.log(`ScorchedMarket address: ${scorchedMarket.address}`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
