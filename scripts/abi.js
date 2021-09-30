const fs = require('fs')
const path = require('path')

const scorchedArtifactPath = path.join(__dirname, '../artifacts/contracts/Scorched.sol/Scorched.json')

const { abi } = require(scorchedArtifactPath)

fs.writeFileSync(path.join(__dirname, '../src/ScorchedABI.json'), JSON.stringify(abi, null, 2))
