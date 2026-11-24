/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/scratchers.json`.
 */
export type Scratchers = {
  "address": "EQaiygfGRcn53N3EEMArDapzcw54iZL6UcuTpSPu2Ygn",
  "metadata": {
    "name": "scratchers",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Stock Scratchers: VRF scratch cards paying tokenized stock"
  },
  "instructions": [
    {
      "name": "ackSold",
      "docs": [
        "Keeper: record that sold shares were credited to the rollup inventory mirror."
      ],
      "discriminator": [
        124,
        213,
        91,
        59,
        77,
        39,
        176,
        230
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "quote",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  113,
                  117,
                  111,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "quote.stockMint",
                "account": "sellQuote"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "totalSynced",
          "type": "u64"
        }
      ]
    },
    {
      "name": "buyCard",
      "discriminator": [
        113,
        142,
        149,
        246,
        22,
        115,
        156,
        154
      ],
      "accounts": [
        {
          "name": "signer",
          "docs": [
            "Authority or its session key."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "authority"
        },
        {
          "name": "player",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "series",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  114,
                  105,
                  101,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "series.id",
                "account": "series"
              }
            ]
          }
        },
        {
          "name": "vaultState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "series.stockMint",
                "account": "series"
              }
            ]
          }
        },
        {
          "name": "stats",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "series.id",
                "account": "series"
              }
            ]
          }
        },
        {
          "name": "priceFeed"
        },
        {
          "name": "oracleQueue",
          "writable": true
        },
        {
          "name": "programIdentity",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  100,
                  101,
                  110,
                  116,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "vrfProgram",
          "address": "Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz"
        },
        {
          "name": "slotHashes",
          "address": "SysvarS1otHashes111111111111111111111111111"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "n",
          "type": "u8"
        },
        {
          "name": "maxPrice",
          "type": "u64"
        },
        {
          "name": "callerSeed",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "cancelPending",
      "discriminator": [
        74,
        87,
        109,
        242,
        64,
        192,
        151,
        71
      ],
      "accounts": [
        {
          "name": "signer",
          "signer": true
        },
        {
          "name": "authority"
        },
        {
          "name": "player",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "series",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  114,
                  105,
                  101,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "series.id",
                "account": "series"
              }
            ]
          }
        },
        {
          "name": "vaultState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "series.stockMint",
                "account": "series"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "cardId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "claimAll",
      "discriminator": [
        194,
        194,
        80,
        194,
        234,
        210,
        217,
        90
      ],
      "accounts": [
        {
          "name": "signer",
          "docs": [
            "Authority or its session key."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "authority"
        },
        {
          "name": "player",
          "docs": [
            "Payer of its own commit, escrow authority of its actions, and the committed account."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "series",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  114,
                  105,
                  101,
                  115
                ]
              },
              {
                "kind": "arg",
                "path": "seriesId"
              }
            ]
          }
        },
        {
          "name": "vaultState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "series.stockMint",
                "account": "series"
              }
            ]
          }
        },
        {
          "name": "delegationRecordPlayer"
        },
        {
          "name": "magicFeeVault",
          "writable": true
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "seriesId",
          "type": "u16"
        }
      ]
    },
    {
      "name": "createSeries",
      "discriminator": [
        181,
        9,
        52,
        120,
        197,
        221,
        42,
        142
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "series",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  114,
                  105,
                  101,
                  115
                ]
              },
              {
                "kind": "arg",
                "path": "args.id"
              }
            ]
          }
        },
        {
          "name": "stockMint"
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "createSeriesArgs"
            }
          }
        }
      ]
    },
    {
      "name": "createSession",
      "discriminator": [
        242,
        193,
        143,
        179,
        150,
        25,
        122,
        227
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "player",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "sessionKey",
          "type": "pubkey"
        },
        {
          "name": "expiry",
          "type": "i64"
        },
        {
          "name": "capE6",
          "type": "u64"
        }
      ]
    },
    {
      "name": "delegateFeed",
      "discriminator": [
        60,
        208,
        248,
        25,
        136,
        243,
        106,
        82
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "bufferFeed",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "feed"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                199,
                50,
                107,
                147,
                24,
                27,
                227,
                68,
                93,
                220,
                45,
                187,
                192,
                4,
                110,
                180,
                160,
                182,
                184,
                39,
                130,
                166,
                139,
                78,
                198,
                94,
                237,
                174,
                125,
                236,
                221,
                71
              ]
            }
          }
        },
        {
          "name": "delegationRecordFeed",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "feed"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataFeed",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "feed"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "feed",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  101,
                  101,
                  100
                ]
              },
              {
                "kind": "arg",
                "path": "feedId"
              }
            ]
          }
        },
        {
          "name": "ownerProgram",
          "address": "EQaiygfGRcn53N3EEMArDapzcw54iZL6UcuTpSPu2Ygn"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "feedId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "validator",
          "type": {
            "option": "pubkey"
          }
        }
      ]
    },
    {
      "name": "delegatePlayer",
      "discriminator": [
        235,
        159,
        245,
        102,
        161,
        199,
        254,
        89
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "bufferPlayer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "player"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                199,
                50,
                107,
                147,
                24,
                27,
                227,
                68,
                93,
                220,
                45,
                187,
                192,
                4,
                110,
                180,
                160,
                182,
                184,
                39,
                130,
                166,
                139,
                78,
                198,
                94,
                237,
                174,
                125,
                236,
                221,
                71
              ]
            }
          }
        },
        {
          "name": "delegationRecordPlayer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "player"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataPlayer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "player"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "player",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "ownerProgram",
          "address": "EQaiygfGRcn53N3EEMArDapzcw54iZL6UcuTpSPu2Ygn"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "validator",
          "type": {
            "option": "pubkey"
          }
        }
      ]
    },
    {
      "name": "delegateStats",
      "discriminator": [
        185,
        133,
        115,
        213,
        221,
        169,
        0,
        138
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "bufferStats",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "stats"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                199,
                50,
                107,
                147,
                24,
                27,
                227,
                68,
                93,
                220,
                45,
                187,
                192,
                4,
                110,
                180,
                160,
                182,
                184,
                39,
                130,
                166,
                139,
                78,
                198,
                94,
                237,
                174,
                125,
                236,
                221,
                71
              ]
            }
          }
        },
        {
          "name": "delegationRecordStats",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "stats"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataStats",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "stats"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "stats",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              },
              {
                "kind": "arg",
                "path": "seriesId"
              }
            ]
          }
        },
        {
          "name": "ownerProgram",
          "address": "EQaiygfGRcn53N3EEMArDapzcw54iZL6UcuTpSPu2Ygn"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "seriesId",
          "type": "u16"
        },
        {
          "name": "validator",
          "type": {
            "option": "pubkey"
          }
        }
      ]
    },
    {
      "name": "delegateVault",
      "discriminator": [
        166,
        89,
        17,
        247,
        90,
        45,
        115,
        224
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "stockMint"
        },
        {
          "name": "bufferVaultState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "vaultState"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                199,
                50,
                107,
                147,
                24,
                27,
                227,
                68,
                93,
                220,
                45,
                187,
                192,
                4,
                110,
                180,
                160,
                182,
                184,
                39,
                130,
                166,
                139,
                78,
                198,
                94,
                237,
                174,
                125,
                236,
                221,
                71
              ]
            }
          }
        },
        {
          "name": "delegationRecordVaultState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "vaultState"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataVaultState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "vaultState"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "vaultState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "stockMint"
              }
            ]
          }
        },
        {
          "name": "ownerProgram",
          "address": "EQaiygfGRcn53N3EEMArDapzcw54iZL6UcuTpSPu2Ygn"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "validator",
          "type": {
            "option": "pubkey"
          }
        }
      ]
    },
    {
      "name": "depositUsdc",
      "docs": [
        "Move USDC from the user's rollup token account into the program treasury and credit the ledger."
      ],
      "discriminator": [
        184,
        148,
        250,
        169,
        224,
        213,
        34,
        126
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "Must be the Player owner: a session key can spend its cap on cards but never move funds."
          ],
          "signer": true
        },
        {
          "name": "player",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "userUsdc",
          "docs": [
            "The user's eSPL balance (canonical ATA on the rollup)."
          ],
          "writable": true
        },
        {
          "name": "treasuryAuth",
          "docs": [
            "(rollup-only), and a base-layer account at the same ATA address would only be cloned read-only."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "treasuryUsdc",
          "docs": [
            "Program-held USDC on the rollup (a Magic ATA owned by `treasury_auth`)."
          ],
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "freezeSeries",
      "discriminator": [
        18,
        56,
        150,
        165,
        254,
        12,
        244,
        245
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "series",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  114,
                  105,
                  101,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "series.id",
                "account": "series"
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "config"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "initConfig",
      "discriminator": [
        23,
        235,
        115,
        232,
        168,
        96,
        1,
        231
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "keeper",
          "type": "pubkey"
        },
        {
          "name": "usdcMint",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "initFeed",
      "discriminator": [
        203,
        50,
        143,
        146,
        170,
        34,
        46,
        93
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "feed",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  101,
                  101,
                  100
                ]
              },
              {
                "kind": "arg",
                "path": "feedId"
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "feedId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "pusher",
          "type": "pubkey"
        },
        {
          "name": "expo",
          "type": "i32"
        },
        {
          "name": "maxMoveBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "initSellQuote",
      "docs": [
        "Admin: create the base-layer sell quote + the USDC sell pool for a stock mint."
      ],
      "discriminator": [
        196,
        207,
        1,
        215,
        249,
        37,
        57,
        142
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "quote",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  113,
                  117,
                  111,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "stockMint"
              }
            ]
          }
        },
        {
          "name": "stockMint"
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "sellPool",
          "docs": [
            "USDC the program pays sellers from (owned by the Config PDA). Fund it with plain transfers."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "config"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "priceE8",
          "type": "u64"
        },
        {
          "name": "ts",
          "type": "i64"
        }
      ]
    },
    {
      "name": "initStats",
      "discriminator": [
        203,
        189,
        229,
        174,
        240,
        190,
        158,
        110
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "series",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  114,
                  105,
                  101,
                  115
                ]
              },
              {
                "kind": "arg",
                "path": "seriesId"
              }
            ]
          }
        },
        {
          "name": "stats",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              },
              {
                "kind": "arg",
                "path": "seriesId"
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "seriesId",
          "type": "u16"
        }
      ]
    },
    {
      "name": "initVault",
      "discriminator": [
        77,
        79,
        85,
        150,
        33,
        217,
        52,
        106
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "vaultState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "stockMint"
              }
            ]
          }
        },
        {
          "name": "stockMint"
        },
        {
          "name": "vaultToken",
          "docs": [
            "Stock vault token account, owned by the vault_state PDA."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vaultState"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "stockMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "markSettled",
      "discriminator": [
        85,
        36,
        192,
        146,
        83,
        42,
        49,
        60
      ],
      "accounts": [
        {
          "name": "authority"
        },
        {
          "name": "player",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "payout",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  111,
                  117,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "player"
              },
              {
                "kind": "arg",
                "path": "cardId"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "cardId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "payOut",
      "docs": [
        "Keeper repair path (base layer)."
      ],
      "discriminator": [
        122,
        7,
        14,
        119,
        71,
        188,
        166,
        34
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "keeper",
          "writable": true,
          "signer": true
        },
        {
          "name": "player"
        },
        {
          "name": "series"
        },
        {
          "name": "vaultState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "series.stockMint",
                "account": "series"
              }
            ]
          }
        },
        {
          "name": "vaultToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vaultState"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "stockMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "dest",
          "writable": true
        },
        {
          "name": "stockMint"
        },
        {
          "name": "payout",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  111,
                  117,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "player"
              },
              {
                "kind": "arg",
                "path": "cardId"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "cardId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "payOutAction",
      "docs": [
        "Magic Action target (base layer); only reachable via the delegation program's escrow signature."
      ],
      "discriminator": [
        177,
        37,
        30,
        11,
        7,
        121,
        30,
        130
      ],
      "accounts": [
        {
          "name": "player"
        },
        {
          "name": "series"
        },
        {
          "name": "vaultState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "series.stockMint",
                "account": "series"
              }
            ]
          }
        },
        {
          "name": "vaultToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vaultState"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "stockMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "dest",
          "writable": true
        },
        {
          "name": "stockMint"
        },
        {
          "name": "payout",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  111,
                  117,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "player"
              },
              {
                "kind": "arg",
                "path": "cardId"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "sourceProgram",
          "address": "EQaiygfGRcn53N3EEMArDapzcw54iZL6UcuTpSPu2Ygn"
        },
        {
          "name": "escrowAuth"
        },
        {
          "name": "escrow",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "cardId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "processUndelegation",
      "discriminator": [
        196,
        28,
        41,
        206,
        48,
        37,
        51,
        167
      ],
      "accounts": [
        {
          "name": "baseAccount",
          "writable": true
        },
        {
          "name": "buffer",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  110,
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  101,
                  45,
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "baseAccount"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                181,
                183,
                0,
                225,
                242,
                87,
                58,
                192,
                204,
                6,
                34,
                1,
                52,
                74,
                207,
                151,
                184,
                53,
                6,
                235,
                140,
                229,
                25,
                152,
                204,
                98,
                126,
                24,
                147,
                128,
                167,
                62
              ]
            }
          }
        },
        {
          "name": "payer",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "accountSeeds",
          "type": {
            "vec": "bytes"
          }
        }
      ]
    },
    {
      "name": "pushPrice",
      "discriminator": [
        113,
        238,
        232,
        235,
        60,
        71,
        127,
        203
      ],
      "accounts": [
        {
          "name": "pusher",
          "signer": true,
          "relations": [
            "feed"
          ]
        },
        {
          "name": "feed",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "price",
          "type": "i64"
        },
        {
          "name": "conf",
          "type": "u64"
        },
        {
          "name": "publishTs",
          "type": "i64"
        }
      ]
    },
    {
      "name": "revokeSession",
      "discriminator": [
        86,
        92,
        198,
        120,
        144,
        2,
        7,
        194
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "player",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "sellToVault",
      "docs": [
        "Player: sell stock shares to the vault at the quote (devnet mock pool; mainnet uses the Payments API)."
      ],
      "discriminator": [
        234,
        0,
        247,
        221,
        161,
        35,
        97,
        111
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "quote",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  113,
                  117,
                  111,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "stockMint"
              }
            ]
          }
        },
        {
          "name": "stockMint"
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "userStock",
          "writable": true
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "stockMint"
              }
            ]
          }
        },
        {
          "name": "vaultToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "stockMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "sellPool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "config"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "userUsdc",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "shares",
          "type": "u64"
        },
        {
          "name": "minUsdcE6",
          "type": "u64"
        }
      ]
    },
    {
      "name": "setSellQuote",
      "docs": [
        "Keeper: post a fresh sell quote."
      ],
      "discriminator": [
        9,
        21,
        62,
        236,
        222,
        24,
        1,
        26
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "quote",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  113,
                  117,
                  111,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "quote.stockMint",
                "account": "sellQuote"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "priceE8",
          "type": "u64"
        },
        {
          "name": "ts",
          "type": "i64"
        }
      ]
    },
    {
      "name": "signup",
      "discriminator": [
        131,
        45,
        148,
        237,
        166,
        142,
        235,
        53
      ],
      "accounts": [
        {
          "name": "player",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "syncInventory",
      "discriminator": [
        17,
        58,
        27,
        193,
        139,
        86,
        147,
        216
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "vaultState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vaultState.stockMint",
                "account": "vaultState"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "addedShares",
          "type": "u64"
        }
      ]
    },
    {
      "name": "undelegateFeed",
      "discriminator": [
        242,
        59,
        86,
        179,
        42,
        238,
        58,
        66
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "feed",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  101,
                  101,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "feed.feedId",
                "account": "priceFeed"
              }
            ]
          }
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "undelegatePlayer",
      "discriminator": [
        230,
        242,
        176,
        199,
        120,
        26,
        119,
        243
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "player",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "undelegateStats",
      "discriminator": [
        22,
        11,
        169,
        185,
        126,
        54,
        203,
        124
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "stats",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "stats.series",
                "account": "stats"
              }
            ]
          }
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "undelegateVault",
      "discriminator": [
        189,
        43,
        85,
        225,
        56,
        191,
        123,
        212
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "vaultState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vaultState.stockMint",
                "account": "vaultState"
              }
            ]
          }
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "vrfCallback",
      "discriminator": [
        248,
        224,
        55,
        227,
        56,
        10,
        108,
        36
      ],
      "accounts": [
        {
          "name": "vrfProgramIdentity",
          "docs": [
            "Signer proves the callback was issued by the VRF program for this program."
          ],
          "signer": true,
          "address": "2ipweEufWsokGqjDSPuySQWP5A9j7kDdmzdhUG1J3n6v"
        },
        {
          "name": "player",
          "writable": true
        },
        {
          "name": "series"
        },
        {
          "name": "vaultState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "series.stockMint",
                "account": "series"
              }
            ]
          }
        },
        {
          "name": "stats",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "series.id",
                "account": "series"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "randomness",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "cardId",
          "type": "u64"
        },
        {
          "name": "requestId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "withdrawUsdc",
      "discriminator": [
        114,
        49,
        72,
        184,
        27,
        156,
        243,
        155
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "Must be the Player owner: a session key can spend its cap on cards but never move funds."
          ],
          "signer": true
        },
        {
          "name": "player",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "userUsdc",
          "docs": [
            "The user's eSPL balance (canonical ATA on the rollup)."
          ],
          "writable": true
        },
        {
          "name": "treasuryAuth",
          "docs": [
            "(rollup-only), and a base-layer account at the same ATA address would only be cloned read-only."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "treasuryUsdc",
          "docs": [
            "Program-held USDC on the rollup (a Magic ATA owned by `treasury_auth`)."
          ],
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "payout",
      "discriminator": [
        69,
        45,
        245,
        131,
        218,
        101,
        158,
        228
      ]
    },
    {
      "name": "player",
      "discriminator": [
        205,
        222,
        112,
        7,
        165,
        155,
        206,
        218
      ]
    },
    {
      "name": "priceFeed",
      "discriminator": [
        189,
        103,
        252,
        23,
        152,
        35,
        243,
        156
      ]
    },
    {
      "name": "sellQuote",
      "discriminator": [
        110,
        144,
        255,
        160,
        152,
        191,
        65,
        9
      ]
    },
    {
      "name": "series",
      "discriminator": [
        240,
        97,
        8,
        183,
        139,
        77,
        250,
        162
      ]
    },
    {
      "name": "stats",
      "discriminator": [
        190,
        125,
        51,
        63,
        169,
        197,
        36,
        238
      ]
    },
    {
      "name": "vaultState",
      "discriminator": [
        228,
        196,
        82,
        165,
        98,
        210,
        235,
        152
      ]
    }
  ],
  "events": [
    {
      "name": "cardBought",
      "discriminator": [
        75,
        216,
        88,
        79,
        221,
        180,
        44,
        67
      ]
    },
    {
      "name": "cardCancelled",
      "discriminator": [
        251,
        105,
        220,
        11,
        82,
        23,
        151,
        75
      ]
    },
    {
      "name": "cardRevealed",
      "discriminator": [
        252,
        80,
        147,
        240,
        129,
        145,
        231,
        208
      ]
    },
    {
      "name": "claimRequested",
      "discriminator": [
        204,
        141,
        47,
        39,
        51,
        65,
        169,
        32
      ]
    },
    {
      "name": "paidOut",
      "discriminator": [
        6,
        137,
        209,
        225,
        252,
        53,
        249,
        252
      ]
    },
    {
      "name": "priceUpdated",
      "discriminator": [
        154,
        72,
        87,
        150,
        246,
        230,
        23,
        217
      ]
    },
    {
      "name": "soldToVault",
      "discriminator": [
        27,
        236,
        79,
        216,
        80,
        249,
        176,
        74
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "paused"
    },
    {
      "code": 6001,
      "name": "seriesNotFrozen"
    },
    {
      "code": 6002,
      "name": "priceStale"
    },
    {
      "code": 6003,
      "name": "priceOutOfBand"
    },
    {
      "code": 6004,
      "name": "priceAboveMax"
    },
    {
      "code": 6005,
      "name": "wrongFeed"
    },
    {
      "code": 6006,
      "name": "insufficientBalance"
    },
    {
      "code": 6007,
      "name": "sessionExpired"
    },
    {
      "code": 6008,
      "name": "sessionCapExceeded"
    },
    {
      "code": 6009,
      "name": "noFreeSlot"
    },
    {
      "code": 6010,
      "name": "insufficientInventory"
    },
    {
      "code": 6011,
      "name": "vrfRequestMismatch"
    },
    {
      "code": 6012,
      "name": "alreadyRevealed"
    },
    {
      "code": 6013,
      "name": "notTimedOut"
    },
    {
      "code": 6014,
      "name": "alreadyPaid"
    },
    {
      "code": 6015,
      "name": "badState"
    },
    {
      "code": 6016,
      "name": "unauthorized"
    },
    {
      "code": 6017,
      "name": "seriesFrozen"
    },
    {
      "code": 6018,
      "name": "badPrizeTable"
    },
    {
      "code": 6019,
      "name": "badMint"
    },
    {
      "code": 6020,
      "name": "slippageExceeded"
    }
  ],
  "types": [
    {
      "name": "card",
      "docs": [
        "Lives inside `Player` (no temp rollup accounts). 112 bytes, no implicit padding."
      ],
      "serialization": "bytemuck",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": "u64"
          },
          {
            "name": "lockedPrice",
            "type": "u64"
          },
          {
            "name": "shares",
            "type": "u64"
          },
          {
            "name": "paidTs",
            "type": "i64"
          },
          {
            "name": "revealedTs",
            "type": "i64"
          },
          {
            "name": "vrfRequestId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "seed",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "series",
            "type": "u16"
          },
          {
            "name": "state",
            "type": "u8"
          },
          {
            "name": "tier",
            "type": "u8"
          },
          {
            "name": "pad",
            "type": {
              "array": [
                "u8",
                4
              ]
            }
          }
        ]
      }
    },
    {
      "name": "cardBought",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "player",
            "type": "pubkey"
          },
          {
            "name": "cardId",
            "type": "u64"
          },
          {
            "name": "series",
            "type": "u16"
          },
          {
            "name": "lockedPrice",
            "type": "u64"
          },
          {
            "name": "requestId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "cardCancelled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "player",
            "type": "pubkey"
          },
          {
            "name": "cardId",
            "type": "u64"
          },
          {
            "name": "refundE6",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "cardRevealed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "player",
            "type": "pubkey"
          },
          {
            "name": "cardId",
            "type": "u64"
          },
          {
            "name": "tier",
            "type": "u8"
          },
          {
            "name": "multiplier",
            "type": "u16"
          },
          {
            "name": "shares",
            "type": "u64"
          },
          {
            "name": "seed",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "claimRequested",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "player",
            "type": "pubkey"
          },
          {
            "name": "series",
            "type": "u16"
          },
          {
            "name": "cards",
            "type": "u8"
          },
          {
            "name": "shares",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "config",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "keeper",
            "type": "pubkey"
          },
          {
            "name": "usdcMint",
            "type": "pubkey"
          },
          {
            "name": "paused",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "createSeriesArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": "u16"
          },
          {
            "name": "priceSource",
            "type": {
              "defined": {
                "name": "priceSource"
              }
            }
          },
          {
            "name": "feed",
            "type": "pubkey"
          },
          {
            "name": "feedExpo",
            "type": "i32"
          },
          {
            "name": "ticketUsdE6",
            "type": "u64"
          },
          {
            "name": "tiers",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "tier"
                  }
                },
                8
              ]
            }
          },
          {
            "name": "totalWeight",
            "type": "u32"
          },
          {
            "name": "demo",
            "type": "bool"
          },
          {
            "name": "maxStalenessS",
            "type": "i64"
          },
          {
            "name": "maxMoveBps",
            "type": "u16"
          },
          {
            "name": "maxConfBps",
            "type": "u16"
          },
          {
            "name": "vrfTimeoutS",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "paidOut",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "player",
            "type": "pubkey"
          },
          {
            "name": "cardId",
            "type": "u64"
          },
          {
            "name": "shares",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "payout",
      "docs": [
        "Exactly-once payout receipt; PDA [\"payout\", player, card_id]."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "shares",
            "type": "u64"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "player",
      "docs": [
        "Zero-copy: 3.5 KB would blow the 4 KB BPF stack as a borsh account."
      ],
      "serialization": "bytemuck",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "sessionKey",
            "type": "pubkey"
          },
          {
            "name": "usdcBalanceE6",
            "type": "u64"
          },
          {
            "name": "nextCardId",
            "type": "u64"
          },
          {
            "name": "sessionExpiry",
            "type": "i64"
          },
          {
            "name": "sessionSpendRemainingE6",
            "type": "u64"
          },
          {
            "name": "cards",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "card"
                  }
                },
                32
              ]
            }
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "pad",
            "type": {
              "array": [
                "u8",
                7
              ]
            }
          }
        ]
      }
    },
    {
      "name": "priceFeed",
      "docs": [
        "Path B price feed: pushed by `pusher` on the rollup (gasless)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "feedId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "price",
            "type": "i64"
          },
          {
            "name": "conf",
            "type": "u64"
          },
          {
            "name": "expo",
            "type": "i32"
          },
          {
            "name": "publishTs",
            "type": "i64"
          },
          {
            "name": "pusher",
            "type": "pubkey"
          },
          {
            "name": "maxMoveBps",
            "type": "u16"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "priceSource",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "magicBlockOracle"
          },
          {
            "name": "selfPushed"
          }
        ]
      }
    },
    {
      "name": "priceUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "feedId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "price",
            "type": "i64"
          },
          {
            "name": "publishTs",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "sellQuote",
      "docs": [
        "Base-layer (never delegated) sell quote for one stock mint, posted by the keeper. `sell_to_vault`",
        "is a single atomic base-layer instruction, so it cannot read the delegated rollup feed."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "stockMint",
            "type": "pubkey"
          },
          {
            "name": "priceE8",
            "docs": [
              "USD per whole share, 1e8 fixed point (mid; the spread is applied at sale time)"
            ],
            "type": "u64"
          },
          {
            "name": "ts",
            "type": "i64"
          },
          {
            "name": "totalSoldShares",
            "docs": [
              "cumulative shares sold into the vault"
            ],
            "type": "u64"
          },
          {
            "name": "syncedSoldShares",
            "docs": [
              "part of `total_sold_shares` already credited to the rollup inventory mirror"
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "series",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": "u16"
          },
          {
            "name": "stockMint",
            "type": "pubkey"
          },
          {
            "name": "priceSource",
            "type": {
              "defined": {
                "name": "priceSource"
              }
            }
          },
          {
            "name": "feed",
            "type": "pubkey"
          },
          {
            "name": "feedExpo",
            "type": "i32"
          },
          {
            "name": "ticketUsdE6",
            "type": "u64"
          },
          {
            "name": "tiers",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "tier"
                  }
                },
                8
              ]
            }
          },
          {
            "name": "totalWeight",
            "type": "u32"
          },
          {
            "name": "frozen",
            "type": "bool"
          },
          {
            "name": "demo",
            "type": "bool"
          },
          {
            "name": "maxStalenessS",
            "type": "i64"
          },
          {
            "name": "maxMoveBps",
            "type": "u16"
          },
          {
            "name": "maxConfBps",
            "type": "u16"
          },
          {
            "name": "vrfTimeoutS",
            "type": "i64"
          },
          {
            "name": "lastPrice",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "soldToVault",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "stockMint",
            "type": "pubkey"
          },
          {
            "name": "shares",
            "type": "u64"
          },
          {
            "name": "usdcE6",
            "type": "u64"
          },
          {
            "name": "priceE8",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "stats",
      "docs": [
        "Public per-series counters, delegated so `buy_card` / `vrf_callback` can update them on the rollup.",
        "`tier_counts` is indexed like `Series.tiers`; `shares_won` is the reveal-time liability (before claim)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "series",
            "type": "u16"
          },
          {
            "name": "cardsSold",
            "type": "u64"
          },
          {
            "name": "tierCounts",
            "type": {
              "array": [
                "u64",
                8
              ]
            }
          },
          {
            "name": "sharesWon",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "tier",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "multiplier",
            "type": "u16"
          },
          {
            "name": "weight",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "vaultState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "stockMint",
            "type": "pubkey"
          },
          {
            "name": "usdcInE6",
            "type": "u64"
          },
          {
            "name": "reservedShares",
            "type": "u64"
          },
          {
            "name": "availableSharesMirror",
            "type": "u64"
          },
          {
            "name": "lastOraclePrice",
            "docs": [
              "Path A only: last oracle price/time seen by `buy_card`, for the max-move band"
            ],
            "type": "u64"
          },
          {
            "name": "lastOracleTs",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
