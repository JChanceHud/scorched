pragma solidity ^0.7.0;
// pragma experimental ABIEncoderV2;

contract ScorchedMarket {
  address[] public suggesters;
  mapping (address => uint) suggesterIndexes;
  mapping (address => string) public suggesterUrls;
  mapping (address => string) public suggesterNames;

  constructor() {
    suggesters.push(address(0));
  }

  function registerSuggester(string memory url, string memory name) public {
    require(suggesterIndexes[msg.sender] == 0);
    suggesters.push(msg.sender);
    suggesterIndexes[msg.sender] = suggesters.length - 1;
    suggesterUrls[msg.sender] = url;
    suggesterNames[msg.sender] = name;
  }

  function updateUrl(string memory url) public {
    require(suggesterIndexes[msg.sender] != 0);
    suggesterUrls[msg.sender] = url;
  }

  function updateName(string memory name) public {
    require(suggesterIndexes[msg.sender] != 0);
    suggesterNames[msg.sender] = name;
  }

  // must be sent by suggester
  function unregisterSuggester() public {
    require(suggesterIndexes[msg.sender] != 0);
    uint index = suggesterIndexes[msg.sender];
    suggesters[index] = address(0);
    suggesterIndexes[msg.sender] = 0;
    suggesterUrls[msg.sender] = '';
    suggesterNames[msg.sender] = '';
  }

  function suggesterCount() public view returns (uint) {
    return suggesters.length;
  }
}
