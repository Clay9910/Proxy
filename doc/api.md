# 方法
## nonces
获取用户当前的随机数

**Parameters**
-   `(address)`    用户的地址

**Returns**
-   `(uint)`
- - -

## chainID
获取当前链的chainid

**Returns**
-   `(uint)`
- - -

## isRelayerInWhiteList
查询某个地址是否在relayer白名单中

**Parameters**
-   `(address)` 待查询的地址

**Returns**
-   `(bool)`
- - -

## isAssetInWhiteList
查询某个地址是否在资产白名单中

**Parameters**
-   `(address)` 待查询的地址

**Returns**
-   `(bool)`
- - -

## getDepositInfoCurrent
查询某个地址的质押详情

**Parameters**
-   `(address)` 待查询的地址
-   `(address)` 资产地址
-   `(uint)` 目标链的chainid

**Returns**
-   `(uint)`    质押的金额
-   `(uint)`    给中继器的奖励数量
-   `(uint)`    nonce
-   `(uint)`    过期时间
-   `(address)`    质押的用户的地址
-   `(address)`    中继器的地址（如果中继器还没有lock，那就为0）
- - -

## getHarvestInfoCurrent
查询某个地址可以领取资产的详情

**Parameters**
-   `(address)` 待查询的地址
-   `(address)` 资产地址
-   `(uint)` 源链的chainid

**Returns**
-   `(uint)`    可以领取的数额
-   `(uint)`    nonce
-   `(uint)`    过期时间
- - -

## getDomainSeparator
获取某个chainid对应的eip712的hash结果

**Parameters**
-   `(uint)` chainid

**Returns**
-   `(bytes32)`   
- - -

## setDomainSeparator
设置某个chainid对应的eip712，管理员接口

**Parameters**
-   `(uint)` chainid
  
- - -

## setAssetWhiteList
设置某个资产加入或者移除白名单，管理员接口

**Parameters**
-   `(address)` 资产地址
-   `(bool)` true表示加入白名单,false表示移除白名单
- - -

## setRelayerWhiteList
设置某个地址加入或者移除中继器白名单，管理员接口

**Parameters**
-   `(address)` 地址
-   `(bool)` true表示加入白名单,false表示移除白名单
- - -

## deposit
用户质押资产到源链

**Parameters**
-   `(address)` 资产地址
-   `(uint)` 质押资金的数额，即代表需要跨链多少数额的资产
-   `(uint)` 给中继器的奖励
-   `(uint)` 目标链的id
- - -

## withdraw
用户在超时后取回源链中的资金

**Parameters**
-   `(address)` 资产地址
-   `(uint)` 目标链的id
- - -

## lock
中继器锁定某笔质押，表示自己来处理这比跨链，限定中继器白名单中的地址调用

**Parameters**
-   `(address)` 资产地址
-   `(address)` 用户地址
-   `(uint)` 目标链的id
- - -

## depositForRelayer
中继器质押资金，限定中继器白名单中的地址调用

**Parameters**
-   `(address)` 资产地址
-   `(address)` 用户地址
-   `(uint)` 质押的资金数额
-   `(uint)` 源链质押时候的nonce
-   `(uint)` 源链的id
-   `(uint)` 目标链的id
-   `(uint)` 过期时间
- - -

## harvest
用户领取目标链中的资产

**Parameters**
-   `(address)` 资产地址
-   `(uint)` 源链的id
-   `(v)` 用户签名数据中的
-   `(r)` 用户签名数据中的
-   `(s)` 用户签名数据中的
- - -

## harvestForRealyer
中继器领取源链中的资产

**Parameters**
-   `(address)` 资产地址
-   `(address)` 用户地址
-   `(uint)` 目标链的id
-   `(v)` 用户签名数据中的
-   `(r)` 用户签名数据中的
-   `(s)` 用户签名数据中的
- - -

# 通知
##  SetRelayerWhiteList(address indexed relayer, bool state)
管理员设置中继器白名单时会触发此通知

##  SeAssetWhiteList(address indexed asset, bool state)
管理员设置资产白名单时会触发此通知


##  Deposit(address indexed user, address indexed asset, uint amount, uint reward, uint nonce, uint deadline, uint chainID, uint chainIDTo)
用户调用deposit方法，质押资产时会触发此通知


##  Withdraw(address indexed user, address indexed asset, uint amount, uint reward, uint nonce)
用户赎回超时资产时会触发此通知

##  Lock(address indexed user, address indexed asset, address indexed relayer, uint deadline)
中继器锁定某比质押时会触发此通知

##  DepositForRelayer(address indexed asset, address indexed user, uint amount, uint deadline, uint chainIDFrom)
中继器质押资产时会触发此通知

##  Harvest(address user, address asset, uint chainIDFrom, uint chainIDTo,uint8 v, bytes32 r, bytes32 s)
用户收获跨链后的资产时会触发此通知

## HarvestForRealyer(address user, address asset, uint amount, uint reward, uint chainIDTo);
中继器收获源链资产时会触发此通知