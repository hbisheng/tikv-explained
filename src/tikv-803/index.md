# TiKV 803: In-Memory Pessimistic Locks

A leader transfer may need to transfer in-memory pessimistic-lock state from the old leader to the target peer. In that case, TiKV asks the target peer for a second `MsgTransferLeader` acknowledgement after transferring the lock state.
