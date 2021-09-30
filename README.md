# Scorched

A 2 of 2 scorched earth implementation.

## Features

This implementation focuses on reducing the number of L1 transactions needed. Suggester/Asker state channels should be long lived with support for renegotiating rates, accepting/refusing queries and depositing/withdrawing funds.

### Query refusal

A suggester should be able to refuse a proposed query.

### Rating exposition

Contracts should expose handles for determining the number of successful queries answered by a suggester.
