(function(globalThis) {
  'use strict';

  const Thread = Java.type("java.lang.Thread");
  const HttpMethod = Java.type("cn.hutool.http.Method");
  const HttpRequest = Java.type("cn.hutool.http.HttpRequest");
  const Base64 = Java.type('java.util.Base64');

  const wait = function(delay) {
    Thread.sleep(delay);
  }
  const fetch = function(req) {
    var newReq = HttpRequest.of(req.url);
    newReq.method(HttpMethod.valueOf(req.method));
    newReq.headerMap(req.headers, true);
    if(req.body) {
      print(`[SOL]`, req.body);
      newReq.body(req.body);
    }
    return newReq.execute();
  }

  const Charset = Java.type('java.nio.charset.Charset');
  const CharBuffer = Java.type('java.nio.CharBuffer');
  const ByteBuffer = Java.type('java.nio.ByteBuffer');
  
  class TextEncoder {
    encode(str) {
      if (str === undefined) str = '';
      str = String(str);
      
      // 使用Charset直接编码
      const charset = Charset.forName("UTF-8");
      const charBuffer = CharBuffer.wrap(str.split(''));
      const byteBuffer = charset.encode(charBuffer);
      
      // 转换为Uint8Array
      const uint8Array = new Uint8Array(byteBuffer.remaining());
      for (let i = 0; i < uint8Array.length; i++) {
        uint8Array[i] = byteBuffer.get() & 0xFF;
      }
      return uint8Array;
    }
  }

  class TextDecoder {
    decode(uint8Array) {
      // 创建ByteBuffer
      const byteBuffer = ByteBuffer.allocate(uint8Array.length);
      for (let i = 0; i < uint8Array.length; i++) {
        byteBuffer.put(i, uint8Array[i]);
      }
      byteBuffer.flip();
      
      // 使用Charset解码
      const charset = Charset.forName("UTF-8");
      const charBuffer = charset.decode(byteBuffer);
      return String(charBuffer.toString());
    }
  }

  // 添加到全局对象
  globalThis.TextEncoder = TextEncoder;
  globalThis.TextDecoder = TextDecoder;

  // base64编码: string -> base64
  const btoa = function(str) {
    // 字符串转byte数组
    const bytes = new (Java.type('java.lang.String'))(str)
      .getBytes('UTF-8');

    // 使用Base64编码
    return Base64.getEncoder().encodeToString(bytes);
  };

  // base64解码: base64 -> string
  const atob = function(base64Str) {
    // Base64解码为byte数组
    const bytes = Base64.getDecoder().decode(base64Str);
    // byte数组转字符串
    return new (Java.type('java.lang.String'))(bytes, 'UTF-8');
  };

  const MessageDigest = Java.type('java.security.MessageDigest');
  const SecureRandom = Java.type('java.security.SecureRandom');
  const KeyPairGenerator = Java.type('java.security.KeyPairGenerator');
  const Signature = Java.type('java.security.Signature');

  // 实现 crypto 相关功能
  const crypto = {
    // 随机数生成
    getRandomValues(array) {
      const secureRandom = new SecureRandom();
      // 使用 Java.type 获取 byte 数组类型
      const ByteArray = Java.type("byte[]");
      const bytes = new ByteArray(array.length);
      secureRandom.nextBytes(bytes);
      for (let i = 0; i < bytes.length; i++) {
        array[i] = bytes[i] & 0xff;
      }
      return array;
    },

    subtle: {
      // 摘要/哈希
      digest(algorithm, data) {
        const md = MessageDigest.getInstance(algorithm.replace('SHA-', 'SHA'));
        const digestBytes = md.digest(data);

        // 将 Java byte[] 转换为 ArrayBuffer
        const buffer = new ArrayBuffer(digestBytes.length);
        const view = new Uint8Array(buffer);
        for (let i = 0; i < digestBytes.length; i++) {
          view[i] = digestBytes[i] & 0xFF;
        }
        
        return buffer;
      },

      // ED25519 密钥生成
      generateKey(algorithm, extractable, keyUsages) {
        if (algorithm === 'Ed25519' || (typeof algorithm === 'object' && algorithm.name === 'Ed25519')) {
          const secureRandom = new SecureRandom();
          const kpg = KeyPairGenerator.getInstance('Ed25519');
          
          // 使用 SecureRandom 初始化密钥对生成器
          const NamedParameterSpec = Java.type('java.security.spec.NamedParameterSpec');
          kpg.initialize(new NamedParameterSpec("Ed25519"), secureRandom);
          
          const keyPair = kpg.generateKeyPair();
          
          // 创建公钥对象
          const publicKey = {
            type: 'public',
            extractable: true,
            algorithm: {
              name: 'Ed25519'
            },
            usages: ['verify']
          };

          // 创建私钥对象
          const privateKey = {
            type: 'private',
            extractable: extractable,
            algorithm: {
              name: 'Ed25519'
            },
            usages: ['sign']
          };

          // 存储密钥的字节数组形式
          Object.defineProperty(publicKey, '_keyBytes', {
            value: keyPair.getPublic().getEncoded(),
            enumerable: false,
            writable: false
          });

          Object.defineProperty(privateKey, '_keyBytes', {
            value: keyPair.getPrivate().getEncoded(),
            enumerable: false,
            writable: false
          });

          // 存储原始的 KeyPair 引用
          Object.defineProperty(publicKey, '_getKeyPair', {
            value: () => keyPair,
            enumerable: false
          });
          Object.defineProperty(privateKey, '_getKeyPair', {
            value: () => keyPair,
            enumerable: false
          });

          // 返回 CryptoKeyPair
          return {
            publicKey,
            privateKey
          };
        }
        
        throw new Error('Unsupported algorithm');
      },

      // 密钥导出
      exportKey(format, key) {
        if (!key.extractable) {
          throw new Error('Key is not extractable');
        }

        if (format !== 'raw') {
          throw new Error('Unsupported export format');
        }

        // 对于 Ed25519 公钥，返回 32 字节的原始格式
        if (key.type === 'public' && key.algorithm.name === 'Ed25519') {
          // 获取存储的密钥字节
          const keyBytes = key._keyBytes;
          
          // 创建 ArrayBuffer
          const buffer = new ArrayBuffer(keyBytes.length);
          const view = new Uint8Array(buffer);
          
          // 复制字节数据
          for (let i = 0; i < keyBytes.length; i++) {
            view[i] = keyBytes[i] & 0xFF;
          }
          
          return buffer;
        }

        throw new Error('Unsupported key type or algorithm');
      },

      importKey(format, keyData, algorithm, extractable, keyUsages) {
        // 检查算法
        if (algorithm !== 'Ed25519' &&
          (typeof algorithm !== 'object' || algorithm.name !== 'Ed25519')) {
          throw new Error('Unsupported algorithm');
        }

        let keyPair;

        switch (format) {
          case 'raw': {
            // raw 格式只支持公钥导入
            if (!(keyData instanceof ArrayBuffer) && !ArrayBuffer.isView(keyData)) {
              throw new Error('Key data must be an ArrayBuffer or ArrayBufferView');
            }

            // 确保是 32 字节的公钥
            if (keyData.byteLength !== 32) {
              throw new Error('Ed25519 public key must be 32 bytes');
            }

            // 创建公钥对象
            const publicKey = {
              type: 'public',
              extractable: true,
              algorithm: {
                name: 'Ed25519'
              },
              usages: ['verify']
            };

            // 存储密钥字节
            Object.defineProperty(publicKey, '_keyBytes', {
              value: new Uint8Array(keyData),
              enumerable: false,
              writable: false
            });

            return publicKey;
          }

          case 'pkcs8': {
            // pkcs8 格式只支持私钥导入
            if (!(keyData instanceof ArrayBuffer) && !ArrayBuffer.isView(keyData)) {
              throw new Error('Key data must be an ArrayBuffer or ArrayBufferView');
            }

            // 使用 Java 的 PKCS8EncodedKeySpec 导入私钥
            const PKCS8EncodedKeySpec = Java.type('java.security.spec.PKCS8EncodedKeySpec');
            const KeyFactory = Java.type('java.security.KeyFactory');
            const keyFactory = KeyFactory.getInstance('Ed25519');
            const keySpec = new PKCS8EncodedKeySpec(keyData);
            const privateKey = keyFactory.generatePrivate(keySpec);

            // 创建密钥对象
            const cryptoKey = {
              type: 'private',
              extractable,
              algorithm: {
                name: 'Ed25519'
              },
              usages: ['sign']
            };

            // 存储密钥字节
            Object.defineProperty(cryptoKey, '_keyBytes', {
              value: privateKey.getEncoded(),
              enumerable: false,
              writable: false
            });

            return cryptoKey;
          }

          case 'spki': {
            // spki 格式只支持公钥导入
            if (!(keyData instanceof ArrayBuffer) && !ArrayBuffer.isView(keyData)) {
              throw new Error('Key data must be an ArrayBuffer or ArrayBufferView');
            }

            // 使用 Java 的 X509EncodedKeySpec 导入公钥
            const X509EncodedKeySpec = Java.type('java.security.spec.X509EncodedKeySpec');
            const KeyFactory = Java.type('java.security.KeyFactory');
            const keyFactory = KeyFactory.getInstance('Ed25519');
            const keySpec = new X509EncodedKeySpec(keyData);
            const publicKey = keyFactory.generatePublic(keySpec);

            // 创建密钥对象
            const cryptoKey = {
              type: 'public',
              extractable: true,
              algorithm: {
                name: 'Ed25519'
              },
              usages: ['verify']
            };

            // 存储密钥字节
            Object.defineProperty(cryptoKey, '_keyBytes', {
              value: publicKey.getEncoded(),
              enumerable: false,
              writable: false
            });

            return cryptoKey;
          }

          default:
            throw new Error('Unsupported key format');
        }
      },

      // 签名
      sign(algorithm, key, data) {
        if (algorithm !== 'Ed25519' &&
          (typeof algorithm !== 'object' || algorithm.name !== 'Ed25519')) {
          throw new Error('Unsupported algorithm');
        }

        // 检查密钥类型
        if (key.type !== 'private' || key.algorithm.name !== 'Ed25519') {
          throw new Error('Invalid key for Ed25519 signing');
        }

        // 执行签名
        const sig = Signature.getInstance('Ed25519');
        sig.initSign(key._getKeyPair().getPrivate());

        // 如果输入是 ArrayBuffer 或其视图，转换为字节数组
        let dataBytes;
        if (ArrayBuffer.isView(data)) {
          dataBytes = new Int8Array(data.buffer, data.byteOffset, data.byteLength);
        } else if (data instanceof ArrayBuffer) {
          dataBytes = new Int8Array(data);
        } else {
          throw new Error('Data must be an ArrayBuffer or ArrayBufferView');
        }

        sig.update(dataBytes);
        const signatureBytes = sig.sign();

        // 将 Java 字节数组转换为 ArrayBuffer
        const buffer = new ArrayBuffer(signatureBytes.length);
        const view = new Uint8Array(buffer);
        for (let i = 0; i < signatureBytes.length; i++) {
          view[i] = signatureBytes[i] & 0xFF;
        }

        return buffer;
      },

      // 验证
      verify(algorithm, key, signature, data) {
        // 检查算法
        if (algorithm !== 'Ed25519' &&
          (typeof algorithm !== 'object' || algorithm.name !== 'Ed25519')) {
          throw new Error('Unsupported algorithm');
        }

        // 检查密钥类型
        if (key.type !== 'public' || key.algorithm.name !== 'Ed25519') {
          throw new Error('Invalid key for Ed25519 verification');
        }

        const sig = Signature.getInstance('Ed25519');
        sig.initVerify(key._getKeyPair().getPublic());

        // 转换数据
        let dataBytes;
        if (ArrayBuffer.isView(data)) {
          dataBytes = new Int8Array(data.buffer, data.byteOffset, data.byteLength);
        } else if (data instanceof ArrayBuffer) {
          dataBytes = new Int8Array(data);
        } else {
          throw new Error('Data must be an ArrayBuffer or ArrayBufferView');
        }

        // 转换签名
        let signatureBytes;
        if (ArrayBuffer.isView(signature)) {
          signatureBytes = new Int8Array(signature.buffer, signature.byteOffset, signature.byteLength);
        } else if (signature instanceof ArrayBuffer) {
          signatureBytes = new Int8Array(signature);
        } else {
          throw new Error('Signature must be an ArrayBuffer or ArrayBufferView');
        }

        try {
          sig.update(dataBytes);
          return sig.verify(signatureBytes);
        } catch (error) {
          // 如果验证过程中出现错误，返回 false
          return false;
        }      
      }
    }
  };

  // 添加到全局对象
  globalThis.crypto = crypto;

  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, {
    enumerable: true,
    configurable: true,
    writable: true,
    value
  }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // ../errors/dist/index.browser.mjs
  var SOLANA_ERROR__BLOCK_HEIGHT_EXCEEDED = 1;
  var SOLANA_ERROR__INVALID_NONCE = 2;
  var SOLANA_ERROR__NONCE_ACCOUNT_NOT_FOUND = 3;
  var SOLANA_ERROR__BLOCKHASH_STRING_LENGTH_OUT_OF_RANGE = 4;
  var SOLANA_ERROR__INVALID_BLOCKHASH_BYTE_LENGTH = 5;
  var SOLANA_ERROR__LAMPORTS_OUT_OF_RANGE = 6;
  var SOLANA_ERROR__MALFORMED_BIGINT_STRING = 7;
  var SOLANA_ERROR__MALFORMED_NUMBER_STRING = 8;
  var SOLANA_ERROR__TIMESTAMP_OUT_OF_RANGE = 9;
  var SOLANA_ERROR__JSON_RPC__PARSE_ERROR = -32700;
  var SOLANA_ERROR__JSON_RPC__INTERNAL_ERROR = -32603;
  var SOLANA_ERROR__JSON_RPC__INVALID_PARAMS = -32602;
  var SOLANA_ERROR__JSON_RPC__METHOD_NOT_FOUND = -32601;
  var SOLANA_ERROR__JSON_RPC__INVALID_REQUEST = -32600;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_MIN_CONTEXT_SLOT_NOT_REACHED = -32016;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_UNSUPPORTED_TRANSACTION_VERSION = -32015;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_BLOCK_STATUS_NOT_AVAILABLE_YET = -32014;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_TRANSACTION_SIGNATURE_LEN_MISMATCH = -32013;
  var SOLANA_ERROR__JSON_RPC__SCAN_ERROR = -32012;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_TRANSACTION_HISTORY_NOT_AVAILABLE = -32011;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_KEY_EXCLUDED_FROM_SECONDARY_INDEX = -32010;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_LONG_TERM_STORAGE_SLOT_SKIPPED = -32009;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_NO_SNAPSHOT = -32008;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SLOT_SKIPPED = -32007;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_TRANSACTION_PRECOMPILE_VERIFICATION_FAILURE = -32006;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_NODE_UNHEALTHY = -32005;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_BLOCK_NOT_AVAILABLE = -32004;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_TRANSACTION_SIGNATURE_VERIFICATION_FAILURE = -32003;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE = -32002;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_BLOCK_CLEANED_UP = -32001;
  var SOLANA_ERROR__ADDRESSES__INVALID_BYTE_LENGTH = 28e5;
  var SOLANA_ERROR__ADDRESSES__STRING_LENGTH_OUT_OF_RANGE = 2800001;
  var SOLANA_ERROR__ADDRESSES__INVALID_BASE58_ENCODED_ADDRESS = 2800002;
  var SOLANA_ERROR__ADDRESSES__INVALID_ED25519_PUBLIC_KEY = 2800003;
  var SOLANA_ERROR__ADDRESSES__MALFORMED_PDA = 2800004;
  var SOLANA_ERROR__ADDRESSES__PDA_BUMP_SEED_OUT_OF_RANGE = 2800005;
  var SOLANA_ERROR__ADDRESSES__MAX_NUMBER_OF_PDA_SEEDS_EXCEEDED = 2800006;
  var SOLANA_ERROR__ADDRESSES__MAX_PDA_SEED_LENGTH_EXCEEDED = 2800007;
  var SOLANA_ERROR__ADDRESSES__INVALID_SEEDS_POINT_ON_CURVE = 2800008;
  var SOLANA_ERROR__ADDRESSES__FAILED_TO_FIND_VIABLE_PDA_BUMP_SEED = 2800009;
  var SOLANA_ERROR__ADDRESSES__PDA_ENDS_WITH_PDA_MARKER = 2800010;
  var SOLANA_ERROR__ACCOUNTS__ACCOUNT_NOT_FOUND = 323e4;
  var SOLANA_ERROR__ACCOUNTS__ONE_OR_MORE_ACCOUNTS_NOT_FOUND = 32300001;
  var SOLANA_ERROR__ACCOUNTS__FAILED_TO_DECODE_ACCOUNT = 3230002;
  var SOLANA_ERROR__ACCOUNTS__EXPECTED_DECODED_ACCOUNT = 3230003;
  var SOLANA_ERROR__ACCOUNTS__EXPECTED_ALL_ACCOUNTS_TO_BE_DECODED = 3230004;
  var SOLANA_ERROR__SUBTLE_CRYPTO__DISALLOWED_IN_INSECURE_CONTEXT = 361e4;
  var SOLANA_ERROR__SUBTLE_CRYPTO__DIGEST_UNIMPLEMENTED = 3610001;
  var SOLANA_ERROR__SUBTLE_CRYPTO__ED25519_ALGORITHM_UNIMPLEMENTED = 3610002;
  var SOLANA_ERROR__SUBTLE_CRYPTO__EXPORT_FUNCTION_UNIMPLEMENTED = 3610003;
  var SOLANA_ERROR__SUBTLE_CRYPTO__GENERATE_FUNCTION_UNIMPLEMENTED = 3610004;
  var SOLANA_ERROR__SUBTLE_CRYPTO__SIGN_FUNCTION_UNIMPLEMENTED = 3610005;
  var SOLANA_ERROR__SUBTLE_CRYPTO__VERIFY_FUNCTION_UNIMPLEMENTED = 3610006;
  var SOLANA_ERROR__SUBTLE_CRYPTO__CANNOT_EXPORT_NON_EXTRACTABLE_KEY = 3610007;
  var SOLANA_ERROR__CRYPTO__RANDOM_VALUES_FUNCTION_UNIMPLEMENTED = 3611e3;
  var SOLANA_ERROR__KEYS__INVALID_KEY_PAIR_BYTE_LENGTH = 3704e3;
  var SOLANA_ERROR__KEYS__INVALID_PRIVATE_KEY_BYTE_LENGTH = 3704001;
  var SOLANA_ERROR__KEYS__INVALID_SIGNATURE_BYTE_LENGTH = 3704002;
  var SOLANA_ERROR__KEYS__SIGNATURE_STRING_LENGTH_OUT_OF_RANGE = 3704003;
  var SOLANA_ERROR__KEYS__PUBLIC_KEY_MUST_MATCH_PRIVATE_KEY = 3704004;
  var SOLANA_ERROR__INSTRUCTION__EXPECTED_TO_HAVE_ACCOUNTS = 4128e3;
  var SOLANA_ERROR__INSTRUCTION__EXPECTED_TO_HAVE_DATA = 4128001;
  var SOLANA_ERROR__INSTRUCTION__PROGRAM_ID_MISMATCH = 4128002;
  var SOLANA_ERROR__INSTRUCTION_ERROR__UNKNOWN = 4615e3;
  var SOLANA_ERROR__INSTRUCTION_ERROR__GENERIC_ERROR = 4615001;
  var SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_ARGUMENT = 4615002;
  var SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_INSTRUCTION_DATA = 4615003;
  var SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_ACCOUNT_DATA = 4615004;
  var SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_DATA_TOO_SMALL = 4615005;
  var SOLANA_ERROR__INSTRUCTION_ERROR__INSUFFICIENT_FUNDS = 4615006;
  var SOLANA_ERROR__INSTRUCTION_ERROR__INCORRECT_PROGRAM_ID = 4615007;
  var SOLANA_ERROR__INSTRUCTION_ERROR__MISSING_REQUIRED_SIGNATURE = 4615008;
  var SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_ALREADY_INITIALIZED = 4615009;
  var SOLANA_ERROR__INSTRUCTION_ERROR__UNINITIALIZED_ACCOUNT = 4615010;
  var SOLANA_ERROR__INSTRUCTION_ERROR__UNBALANCED_INSTRUCTION = 4615011;
  var SOLANA_ERROR__INSTRUCTION_ERROR__MODIFIED_PROGRAM_ID = 4615012;
  var SOLANA_ERROR__INSTRUCTION_ERROR__EXTERNAL_ACCOUNT_LAMPORT_SPEND = 4615013;
  var SOLANA_ERROR__INSTRUCTION_ERROR__EXTERNAL_ACCOUNT_DATA_MODIFIED = 4615014;
  var SOLANA_ERROR__INSTRUCTION_ERROR__READONLY_LAMPORT_CHANGE = 4615015;
  var SOLANA_ERROR__INSTRUCTION_ERROR__READONLY_DATA_MODIFIED = 4615016;
  var SOLANA_ERROR__INSTRUCTION_ERROR__DUPLICATE_ACCOUNT_INDEX = 4615017;
  var SOLANA_ERROR__INSTRUCTION_ERROR__EXECUTABLE_MODIFIED = 4615018;
  var SOLANA_ERROR__INSTRUCTION_ERROR__RENT_EPOCH_MODIFIED = 4615019;
  var SOLANA_ERROR__INSTRUCTION_ERROR__NOT_ENOUGH_ACCOUNT_KEYS = 4615020;
  var SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_DATA_SIZE_CHANGED = 4615021;
  var SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_NOT_EXECUTABLE = 4615022;
  var SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_BORROW_FAILED = 4615023;
  var SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_BORROW_OUTSTANDING = 4615024;
  var SOLANA_ERROR__INSTRUCTION_ERROR__DUPLICATE_ACCOUNT_OUT_OF_SYNC = 4615025;
  var SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM = 4615026;
  var SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_ERROR = 4615027;
  var SOLANA_ERROR__INSTRUCTION_ERROR__EXECUTABLE_DATA_MODIFIED = 4615028;
  var SOLANA_ERROR__INSTRUCTION_ERROR__EXECUTABLE_LAMPORT_CHANGE = 4615029;
  var SOLANA_ERROR__INSTRUCTION_ERROR__EXECUTABLE_ACCOUNT_NOT_RENT_EXEMPT = 4615030;
  var SOLANA_ERROR__INSTRUCTION_ERROR__UNSUPPORTED_PROGRAM_ID = 4615031;
  var SOLANA_ERROR__INSTRUCTION_ERROR__CALL_DEPTH = 4615032;
  var SOLANA_ERROR__INSTRUCTION_ERROR__MISSING_ACCOUNT = 4615033;
  var SOLANA_ERROR__INSTRUCTION_ERROR__REENTRANCY_NOT_ALLOWED = 4615034;
  var SOLANA_ERROR__INSTRUCTION_ERROR__MAX_SEED_LENGTH_EXCEEDED = 4615035;
  var SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_SEEDS = 4615036;
  var SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_REALLOC = 4615037;
  var SOLANA_ERROR__INSTRUCTION_ERROR__COMPUTATIONAL_BUDGET_EXCEEDED = 4615038;
  var SOLANA_ERROR__INSTRUCTION_ERROR__PRIVILEGE_ESCALATION = 4615039;
  var SOLANA_ERROR__INSTRUCTION_ERROR__PROGRAM_ENVIRONMENT_SETUP_FAILURE = 4615040;
  var SOLANA_ERROR__INSTRUCTION_ERROR__PROGRAM_FAILED_TO_COMPLETE = 4615041;
  var SOLANA_ERROR__INSTRUCTION_ERROR__PROGRAM_FAILED_TO_COMPILE = 4615042;
  var SOLANA_ERROR__INSTRUCTION_ERROR__IMMUTABLE = 4615043;
  var SOLANA_ERROR__INSTRUCTION_ERROR__INCORRECT_AUTHORITY = 4615044;
  var SOLANA_ERROR__INSTRUCTION_ERROR__BORSH_IO_ERROR = 4615045;
  var SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_NOT_RENT_EXEMPT = 4615046;
  var SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_ACCOUNT_OWNER = 4615047;
  var SOLANA_ERROR__INSTRUCTION_ERROR__ARITHMETIC_OVERFLOW = 4615048;
  var SOLANA_ERROR__INSTRUCTION_ERROR__UNSUPPORTED_SYSVAR = 4615049;
  var SOLANA_ERROR__INSTRUCTION_ERROR__ILLEGAL_OWNER = 4615050;
  var SOLANA_ERROR__INSTRUCTION_ERROR__MAX_ACCOUNTS_DATA_ALLOCATIONS_EXCEEDED = 4615051;
  var SOLANA_ERROR__INSTRUCTION_ERROR__MAX_ACCOUNTS_EXCEEDED = 4615052;
  var SOLANA_ERROR__INSTRUCTION_ERROR__MAX_INSTRUCTION_TRACE_LENGTH_EXCEEDED = 4615053;
  var SOLANA_ERROR__INSTRUCTION_ERROR__BUILTIN_PROGRAMS_MUST_CONSUME_COMPUTE_UNITS = 4615054;
  var SOLANA_ERROR__SIGNER__ADDRESS_CANNOT_HAVE_MULTIPLE_SIGNERS = 5508e3;
  var SOLANA_ERROR__SIGNER__EXPECTED_KEY_PAIR_SIGNER = 5508001;
  var SOLANA_ERROR__SIGNER__EXPECTED_MESSAGE_SIGNER = 5508002;
  var SOLANA_ERROR__SIGNER__EXPECTED_MESSAGE_MODIFYING_SIGNER = 5508003;
  var SOLANA_ERROR__SIGNER__EXPECTED_MESSAGE_PARTIAL_SIGNER = 5508004;
  var SOLANA_ERROR__SIGNER__EXPECTED_TRANSACTION_SIGNER = 5508005;
  var SOLANA_ERROR__SIGNER__EXPECTED_TRANSACTION_MODIFYING_SIGNER = 5508006;
  var SOLANA_ERROR__SIGNER__EXPECTED_TRANSACTION_PARTIAL_SIGNER = 5508007;
  var SOLANA_ERROR__SIGNER__EXPECTED_TRANSACTION_SENDING_SIGNER = 5508008;
  var SOLANA_ERROR__SIGNER__TRANSACTION_CANNOT_HAVE_MULTIPLE_SENDING_SIGNERS = 5508009;
  var SOLANA_ERROR__SIGNER__TRANSACTION_SENDING_SIGNER_MISSING = 5508010;
  var SOLANA_ERROR__SIGNER__WALLET_MULTISIGN_UNIMPLEMENTED = 5508011;
  var SOLANA_ERROR__TRANSACTION__INVOKED_PROGRAMS_CANNOT_PAY_FEES = 5663e3;
  var SOLANA_ERROR__TRANSACTION__INVOKED_PROGRAMS_MUST_NOT_BE_WRITABLE = 5663001;
  var SOLANA_ERROR__TRANSACTION__EXPECTED_BLOCKHASH_LIFETIME = 5663002;
  var SOLANA_ERROR__TRANSACTION__EXPECTED_NONCE_LIFETIME = 5663003;
  var SOLANA_ERROR__TRANSACTION__VERSION_NUMBER_OUT_OF_RANGE = 5663004;
  var SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_ADDRESS_LOOKUP_TABLE_CONTENTS_MISSING = 5663005;
  var SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_ADDRESS_LOOKUP_TABLE_INDEX_OUT_OF_RANGE = 5663006;
  var SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_INSTRUCTION_PROGRAM_ADDRESS_NOT_FOUND = 5663007;
  var SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_FEE_PAYER_MISSING = 5663008;
  var SOLANA_ERROR__TRANSACTION__SIGNATURES_MISSING = 5663009;
  var SOLANA_ERROR__TRANSACTION__ADDRESS_MISSING = 5663010;
  var SOLANA_ERROR__TRANSACTION__FEE_PAYER_MISSING = 5663011;
  var SOLANA_ERROR__TRANSACTION__FEE_PAYER_SIGNATURE_MISSING = 5663012;
  var SOLANA_ERROR__TRANSACTION__INVALID_NONCE_TRANSACTION_INSTRUCTIONS_MISSING = 5663013;
  var SOLANA_ERROR__TRANSACTION__INVALID_NONCE_TRANSACTION_FIRST_INSTRUCTION_MUST_BE_ADVANCE_NONCE = 5663014;
  var SOLANA_ERROR__TRANSACTION__ADDRESSES_CANNOT_SIGN_TRANSACTION = 5663015;
  var SOLANA_ERROR__TRANSACTION__CANNOT_ENCODE_WITH_EMPTY_SIGNATURES = 5663016;
  var SOLANA_ERROR__TRANSACTION__MESSAGE_SIGNATURES_MISMATCH = 5663017;
  var SOLANA_ERROR__TRANSACTION__FAILED_TO_ESTIMATE_COMPUTE_LIMIT = 5663018;
  var SOLANA_ERROR__TRANSACTION__FAILED_WHEN_SIMULATING_TO_ESTIMATE_COMPUTE_LIMIT = 5663019;
  var SOLANA_ERROR__TRANSACTION_ERROR__UNKNOWN = 705e4;
  var SOLANA_ERROR__TRANSACTION_ERROR__ACCOUNT_IN_USE = 7050001;
  var SOLANA_ERROR__TRANSACTION_ERROR__ACCOUNT_LOADED_TWICE = 7050002;
  var SOLANA_ERROR__TRANSACTION_ERROR__ACCOUNT_NOT_FOUND = 7050003;
  var SOLANA_ERROR__TRANSACTION_ERROR__PROGRAM_ACCOUNT_NOT_FOUND = 7050004;
  var SOLANA_ERROR__TRANSACTION_ERROR__INSUFFICIENT_FUNDS_FOR_FEE = 7050005;
  var SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ACCOUNT_FOR_FEE = 7050006;
  var SOLANA_ERROR__TRANSACTION_ERROR__ALREADY_PROCESSED = 7050007;
  var SOLANA_ERROR__TRANSACTION_ERROR__BLOCKHASH_NOT_FOUND = 7050008;
  var SOLANA_ERROR__TRANSACTION_ERROR__CALL_CHAIN_TOO_DEEP = 7050009;
  var SOLANA_ERROR__TRANSACTION_ERROR__MISSING_SIGNATURE_FOR_FEE = 7050010;
  var SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ACCOUNT_INDEX = 7050011;
  var SOLANA_ERROR__TRANSACTION_ERROR__SIGNATURE_FAILURE = 7050012;
  var SOLANA_ERROR__TRANSACTION_ERROR__INVALID_PROGRAM_FOR_EXECUTION = 7050013;
  var SOLANA_ERROR__TRANSACTION_ERROR__SANITIZE_FAILURE = 7050014;
  var SOLANA_ERROR__TRANSACTION_ERROR__CLUSTER_MAINTENANCE = 7050015;
  var SOLANA_ERROR__TRANSACTION_ERROR__ACCOUNT_BORROW_OUTSTANDING = 7050016;
  var SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_MAX_BLOCK_COST_LIMIT = 7050017;
  var SOLANA_ERROR__TRANSACTION_ERROR__UNSUPPORTED_VERSION = 7050018;
  var SOLANA_ERROR__TRANSACTION_ERROR__INVALID_WRITABLE_ACCOUNT = 7050019;
  var SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_MAX_ACCOUNT_COST_LIMIT = 7050020;
  var SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_ACCOUNT_DATA_BLOCK_LIMIT = 7050021;
  var SOLANA_ERROR__TRANSACTION_ERROR__TOO_MANY_ACCOUNT_LOCKS = 7050022;
  var SOLANA_ERROR__TRANSACTION_ERROR__ADDRESS_LOOKUP_TABLE_NOT_FOUND = 7050023;
  var SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ADDRESS_LOOKUP_TABLE_OWNER = 7050024;
  var SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ADDRESS_LOOKUP_TABLE_DATA = 7050025;
  var SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ADDRESS_LOOKUP_TABLE_INDEX = 7050026;
  var SOLANA_ERROR__TRANSACTION_ERROR__INVALID_RENT_PAYING_ACCOUNT = 7050027;
  var SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_MAX_VOTE_COST_LIMIT = 7050028;
  var SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_ACCOUNT_DATA_TOTAL_LIMIT = 7050029;
  var SOLANA_ERROR__TRANSACTION_ERROR__DUPLICATE_INSTRUCTION = 7050030;
  var SOLANA_ERROR__TRANSACTION_ERROR__INSUFFICIENT_FUNDS_FOR_RENT = 7050031;
  var SOLANA_ERROR__TRANSACTION_ERROR__MAX_LOADED_ACCOUNTS_DATA_SIZE_EXCEEDED = 7050032;
  var SOLANA_ERROR__TRANSACTION_ERROR__INVALID_LOADED_ACCOUNTS_DATA_SIZE_LIMIT = 7050033;
  var SOLANA_ERROR__TRANSACTION_ERROR__RESANITIZATION_NEEDED = 7050034;
  var SOLANA_ERROR__TRANSACTION_ERROR__PROGRAM_EXECUTION_TEMPORARILY_RESTRICTED = 7050035;
  var SOLANA_ERROR__TRANSACTION_ERROR__UNBALANCED_TRANSACTION = 7050036;
  var SOLANA_ERROR__CODECS__CANNOT_DECODE_EMPTY_BYTE_ARRAY = 8078e3;
  var SOLANA_ERROR__CODECS__INVALID_BYTE_LENGTH = 8078001;
  var SOLANA_ERROR__CODECS__EXPECTED_FIXED_LENGTH = 8078002;
  var SOLANA_ERROR__CODECS__EXPECTED_VARIABLE_LENGTH = 8078003;
  var SOLANA_ERROR__CODECS__ENCODER_DECODER_SIZE_COMPATIBILITY_MISMATCH = 8078004;
  var SOLANA_ERROR__CODECS__ENCODER_DECODER_FIXED_SIZE_MISMATCH = 8078005;
  var SOLANA_ERROR__CODECS__ENCODER_DECODER_MAX_SIZE_MISMATCH = 8078006;
  var SOLANA_ERROR__CODECS__INVALID_NUMBER_OF_ITEMS = 8078007;
  var SOLANA_ERROR__CODECS__ENUM_DISCRIMINATOR_OUT_OF_RANGE = 8078008;
  var SOLANA_ERROR__CODECS__INVALID_DISCRIMINATED_UNION_VARIANT = 8078009;
  var SOLANA_ERROR__CODECS__INVALID_ENUM_VARIANT = 8078010;
  var SOLANA_ERROR__CODECS__NUMBER_OUT_OF_RANGE = 8078011;
  var SOLANA_ERROR__CODECS__INVALID_STRING_FOR_BASE = 8078012;
  var SOLANA_ERROR__CODECS__EXPECTED_POSITIVE_BYTE_LENGTH = 8078013;
  var SOLANA_ERROR__CODECS__OFFSET_OUT_OF_RANGE = 8078014;
  var SOLANA_ERROR__CODECS__INVALID_LITERAL_UNION_VARIANT = 8078015;
  var SOLANA_ERROR__CODECS__LITERAL_UNION_DISCRIMINATOR_OUT_OF_RANGE = 8078016;
  var SOLANA_ERROR__CODECS__UNION_VARIANT_OUT_OF_RANGE = 8078017;
  var SOLANA_ERROR__CODECS__INVALID_CONSTANT = 8078018;
  var SOLANA_ERROR__CODECS__EXPECTED_ZERO_VALUE_TO_MATCH_ITEM_FIXED_SIZE = 8078019;
  var SOLANA_ERROR__CODECS__ENCODED_BYTES_MUST_NOT_INCLUDE_SENTINEL = 8078020;
  var SOLANA_ERROR__CODECS__SENTINEL_MISSING_IN_DECODED_BYTES = 8078021;
  var SOLANA_ERROR__CODECS__CANNOT_USE_LEXICAL_VALUES_AS_ENUM_DISCRIMINATORS = 8078022;
  var SOLANA_ERROR__RPC__INTEGER_OVERFLOW = 81e5;
  var SOLANA_ERROR__RPC__TRANSPORT_HTTP_HEADER_FORBIDDEN = 8100001;
  var SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR = 8100002;
  var SOLANA_ERROR__RPC__API_PLAN_MISSING_FOR_RPC_METHOD = 8100003;
  var SOLANA_ERROR__RPC_SUBSCRIPTIONS__CANNOT_CREATE_SUBSCRIPTION_PLAN = 819e4;
  var SOLANA_ERROR__RPC_SUBSCRIPTIONS__EXPECTED_SERVER_SUBSCRIPTION_ID = 8190001;
  var SOLANA_ERROR__RPC_SUBSCRIPTIONS__CHANNEL_CLOSED_BEFORE_MESSAGE_BUFFERED = 8190002;
  var SOLANA_ERROR__RPC_SUBSCRIPTIONS__CHANNEL_CONNECTION_CLOSED = 8190003;
  var SOLANA_ERROR__RPC_SUBSCRIPTIONS__CHANNEL_FAILED_TO_CONNECT = 8190004;
  var SOLANA_ERROR__INVARIANT_VIOLATION__SUBSCRIPTION_ITERATOR_STATE_MISSING = 99e5;
  var SOLANA_ERROR__INVARIANT_VIOLATION__SUBSCRIPTION_ITERATOR_MUST_NOT_POLL_BEFORE_RESOLVING_EXISTING_MESSAGE_PROMISE = 9900001;
  var SOLANA_ERROR__INVARIANT_VIOLATION__CACHED_ABORTABLE_ITERABLE_CACHE_ENTRY_MISSING = 9900002;
  var SOLANA_ERROR__INVARIANT_VIOLATION__SWITCH_MUST_BE_EXHAUSTIVE = 9900003;
  var SOLANA_ERROR__INVARIANT_VIOLATION__DATA_PUBLISHER_CHANNEL_UNIMPLEMENTED = 9900004;
  var SolanaErrorMessages = {
    [SOLANA_ERROR__ACCOUNTS__ACCOUNT_NOT_FOUND]: "Account not found at address: $address",
    [SOLANA_ERROR__ACCOUNTS__EXPECTED_ALL_ACCOUNTS_TO_BE_DECODED]: "Not all accounts were decoded. Encoded accounts found at addresses: $addresses.",
    [SOLANA_ERROR__ACCOUNTS__EXPECTED_DECODED_ACCOUNT]: "Expected decoded account at address: $address",
    [SOLANA_ERROR__ACCOUNTS__FAILED_TO_DECODE_ACCOUNT]: "Failed to decode account data at address: $address",
    [SOLANA_ERROR__ACCOUNTS__ONE_OR_MORE_ACCOUNTS_NOT_FOUND]: "Accounts not found at addresses: $addresses",
    [SOLANA_ERROR__ADDRESSES__FAILED_TO_FIND_VIABLE_PDA_BUMP_SEED]: "Unable to find a viable program address bump seed.",
    [SOLANA_ERROR__ADDRESSES__INVALID_BASE58_ENCODED_ADDRESS]: "$putativeAddress is not a base58-encoded address.",
    [SOLANA_ERROR__ADDRESSES__INVALID_BYTE_LENGTH]: "Expected base58 encoded address to decode to a byte array of length 32. Actual length: $actualLength.",
    [SOLANA_ERROR__ADDRESSES__INVALID_ED25519_PUBLIC_KEY]: "The `CryptoKey` must be an `Ed25519` public key.",
    [SOLANA_ERROR__ADDRESSES__INVALID_SEEDS_POINT_ON_CURVE]: "Invalid seeds; point must fall off the Ed25519 curve.",
    [SOLANA_ERROR__ADDRESSES__MALFORMED_PDA]: "Expected given program derived address to have the following format: [Address, ProgramDerivedAddressBump].",
    [SOLANA_ERROR__ADDRESSES__MAX_NUMBER_OF_PDA_SEEDS_EXCEEDED]: "A maximum of $maxSeeds seeds, including the bump seed, may be supplied when creating an address. Received: $actual.",
    [SOLANA_ERROR__ADDRESSES__MAX_PDA_SEED_LENGTH_EXCEEDED]: "The seed at index $index with length $actual exceeds the maximum length of $maxSeedLength bytes.",
    [SOLANA_ERROR__ADDRESSES__PDA_BUMP_SEED_OUT_OF_RANGE]: "Expected program derived address bump to be in the range [0, 255], got: $bump.",
    [SOLANA_ERROR__ADDRESSES__PDA_ENDS_WITH_PDA_MARKER]: "Program address cannot end with PDA marker.",
    [SOLANA_ERROR__ADDRESSES__STRING_LENGTH_OUT_OF_RANGE]: "Expected base58-encoded address string of length in the range [32, 44]. Actual length: $actualLength.",
    [SOLANA_ERROR__BLOCKHASH_STRING_LENGTH_OUT_OF_RANGE]: "Expected base58-encoded blockash string of length in the range [32, 44]. Actual length: $actualLength.",
    [SOLANA_ERROR__BLOCK_HEIGHT_EXCEEDED]: "The network has progressed past the last block for which this transaction could have been committed.",
    [SOLANA_ERROR__CODECS__CANNOT_DECODE_EMPTY_BYTE_ARRAY]: "Codec [$codecDescription] cannot decode empty byte arrays.",
    [SOLANA_ERROR__CODECS__CANNOT_USE_LEXICAL_VALUES_AS_ENUM_DISCRIMINATORS]: "Enum codec cannot use lexical values [$stringValues] as discriminators. Either remove all lexical values or set `useValuesAsDiscriminators` to `false`.",
    [SOLANA_ERROR__CODECS__ENCODED_BYTES_MUST_NOT_INCLUDE_SENTINEL]: "Sentinel [$hexSentinel] must not be present in encoded bytes [$hexEncodedBytes].",
    [SOLANA_ERROR__CODECS__ENCODER_DECODER_FIXED_SIZE_MISMATCH]: "Encoder and decoder must have the same fixed size, got [$encoderFixedSize] and [$decoderFixedSize].",
    [SOLANA_ERROR__CODECS__ENCODER_DECODER_MAX_SIZE_MISMATCH]: "Encoder and decoder must have the same max size, got [$encoderMaxSize] and [$decoderMaxSize].",
    [SOLANA_ERROR__CODECS__ENCODER_DECODER_SIZE_COMPATIBILITY_MISMATCH]: "Encoder and decoder must either both be fixed-size or variable-size.",
    [SOLANA_ERROR__CODECS__ENUM_DISCRIMINATOR_OUT_OF_RANGE]: "Enum discriminator out of range. Expected a number in [$formattedValidDiscriminators], got $discriminator.",
    [SOLANA_ERROR__CODECS__EXPECTED_FIXED_LENGTH]: "Expected a fixed-size codec, got a variable-size one.",
    [SOLANA_ERROR__CODECS__EXPECTED_POSITIVE_BYTE_LENGTH]: "Codec [$codecDescription] expected a positive byte length, got $bytesLength.",
    [SOLANA_ERROR__CODECS__EXPECTED_VARIABLE_LENGTH]: "Expected a variable-size codec, got a fixed-size one.",
    [SOLANA_ERROR__CODECS__EXPECTED_ZERO_VALUE_TO_MATCH_ITEM_FIXED_SIZE]: "Codec [$codecDescription] expected zero-value [$hexZeroValue] to have the same size as the provided fixed-size item [$expectedSize bytes].",
    [SOLANA_ERROR__CODECS__INVALID_BYTE_LENGTH]: "Codec [$codecDescription] expected $expected bytes, got $bytesLength.",
    [SOLANA_ERROR__CODECS__INVALID_CONSTANT]: "Expected byte array constant [$hexConstant] to be present in data [$hexData] at offset [$offset].",
    [SOLANA_ERROR__CODECS__INVALID_DISCRIMINATED_UNION_VARIANT]: "Invalid discriminated union variant. Expected one of [$variants], got $value.",
    [SOLANA_ERROR__CODECS__INVALID_ENUM_VARIANT]: "Invalid enum variant. Expected one of [$stringValues] or a number in [$formattedNumericalValues], got $variant.",
    [SOLANA_ERROR__CODECS__INVALID_LITERAL_UNION_VARIANT]: "Invalid literal union variant. Expected one of [$variants], got $value.",
    [SOLANA_ERROR__CODECS__INVALID_NUMBER_OF_ITEMS]: "Expected [$codecDescription] to have $expected items, got $actual.",
    [SOLANA_ERROR__CODECS__INVALID_STRING_FOR_BASE]: "Invalid value $value for base $base with alphabet $alphabet.",
    [SOLANA_ERROR__CODECS__LITERAL_UNION_DISCRIMINATOR_OUT_OF_RANGE]: "Literal union discriminator out of range. Expected a number between $minRange and $maxRange, got $discriminator.",
    [SOLANA_ERROR__CODECS__NUMBER_OUT_OF_RANGE]: "Codec [$codecDescription] expected number to be in the range [$min, $max], got $value.",
    [SOLANA_ERROR__CODECS__OFFSET_OUT_OF_RANGE]: "Codec [$codecDescription] expected offset to be in the range [0, $bytesLength], got $offset.",
    [SOLANA_ERROR__CODECS__SENTINEL_MISSING_IN_DECODED_BYTES]: "Expected sentinel [$hexSentinel] to be present in decoded bytes [$hexDecodedBytes].",
    [SOLANA_ERROR__CODECS__UNION_VARIANT_OUT_OF_RANGE]: "Union variant out of range. Expected an index between $minRange and $maxRange, got $variant.",
    [SOLANA_ERROR__CRYPTO__RANDOM_VALUES_FUNCTION_UNIMPLEMENTED]: "No random values implementation could be found.",
    [SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_ALREADY_INITIALIZED]: "instruction requires an uninitialized account",
    [SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_BORROW_FAILED]: "instruction tries to borrow reference for an account which is already borrowed",
    [SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_BORROW_OUTSTANDING]: "instruction left account with an outstanding borrowed reference",
    [SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_DATA_SIZE_CHANGED]: "program other than the account's owner changed the size of the account data",
    [SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_DATA_TOO_SMALL]: "account data too small for instruction",
    [SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_NOT_EXECUTABLE]: "instruction expected an executable account",
    [SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_NOT_RENT_EXEMPT]: "An account does not have enough lamports to be rent-exempt",
    [SOLANA_ERROR__INSTRUCTION_ERROR__ARITHMETIC_OVERFLOW]: "Program arithmetic overflowed",
    [SOLANA_ERROR__INSTRUCTION_ERROR__BORSH_IO_ERROR]: "Failed to serialize or deserialize account data: $encodedData",
    [SOLANA_ERROR__INSTRUCTION_ERROR__BUILTIN_PROGRAMS_MUST_CONSUME_COMPUTE_UNITS]: "Builtin programs must consume compute units",
    [SOLANA_ERROR__INSTRUCTION_ERROR__CALL_DEPTH]: "Cross-program invocation call depth too deep",
    [SOLANA_ERROR__INSTRUCTION_ERROR__COMPUTATIONAL_BUDGET_EXCEEDED]: "Computational budget exceeded",
    [SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM]: "custom program error: #$code",
    [SOLANA_ERROR__INSTRUCTION_ERROR__DUPLICATE_ACCOUNT_INDEX]: "instruction contains duplicate accounts",
    [SOLANA_ERROR__INSTRUCTION_ERROR__DUPLICATE_ACCOUNT_OUT_OF_SYNC]: "instruction modifications of multiply-passed account differ",
    [SOLANA_ERROR__INSTRUCTION_ERROR__EXECUTABLE_ACCOUNT_NOT_RENT_EXEMPT]: "executable accounts must be rent exempt",
    [SOLANA_ERROR__INSTRUCTION_ERROR__EXECUTABLE_DATA_MODIFIED]: "instruction changed executable accounts data",
    [SOLANA_ERROR__INSTRUCTION_ERROR__EXECUTABLE_LAMPORT_CHANGE]: "instruction changed the balance of an executable account",
    [SOLANA_ERROR__INSTRUCTION_ERROR__EXECUTABLE_MODIFIED]: "instruction changed executable bit of an account",
    [SOLANA_ERROR__INSTRUCTION_ERROR__EXTERNAL_ACCOUNT_DATA_MODIFIED]: "instruction modified data of an account it does not own",
    [SOLANA_ERROR__INSTRUCTION_ERROR__EXTERNAL_ACCOUNT_LAMPORT_SPEND]: "instruction spent from the balance of an account it does not own",
    [SOLANA_ERROR__INSTRUCTION_ERROR__GENERIC_ERROR]: "generic instruction error",
    [SOLANA_ERROR__INSTRUCTION_ERROR__ILLEGAL_OWNER]: "Provided owner is not allowed",
    [SOLANA_ERROR__INSTRUCTION_ERROR__IMMUTABLE]: "Account is immutable",
    [SOLANA_ERROR__INSTRUCTION_ERROR__INCORRECT_AUTHORITY]: "Incorrect authority provided",
    [SOLANA_ERROR__INSTRUCTION_ERROR__INCORRECT_PROGRAM_ID]: "incorrect program id for instruction",
    [SOLANA_ERROR__INSTRUCTION_ERROR__INSUFFICIENT_FUNDS]: "insufficient funds for instruction",
    [SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_ACCOUNT_DATA]: "invalid account data for instruction",
    [SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_ACCOUNT_OWNER]: "Invalid account owner",
    [SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_ARGUMENT]: "invalid program argument",
    [SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_ERROR]: "program returned invalid error code",
    [SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_INSTRUCTION_DATA]: "invalid instruction data",
    [SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_REALLOC]: "Failed to reallocate account data",
    [SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_SEEDS]: "Provided seeds do not result in a valid address",
    [SOLANA_ERROR__INSTRUCTION_ERROR__MAX_ACCOUNTS_DATA_ALLOCATIONS_EXCEEDED]: "Accounts data allocations exceeded the maximum allowed per transaction",
    [SOLANA_ERROR__INSTRUCTION_ERROR__MAX_ACCOUNTS_EXCEEDED]: "Max accounts exceeded",
    [SOLANA_ERROR__INSTRUCTION_ERROR__MAX_INSTRUCTION_TRACE_LENGTH_EXCEEDED]: "Max instruction trace length exceeded",
    [SOLANA_ERROR__INSTRUCTION_ERROR__MAX_SEED_LENGTH_EXCEEDED]: "Length of the seed is too long for address generation",
    [SOLANA_ERROR__INSTRUCTION_ERROR__MISSING_ACCOUNT]: "An account required by the instruction is missing",
    [SOLANA_ERROR__INSTRUCTION_ERROR__MISSING_REQUIRED_SIGNATURE]: "missing required signature for instruction",
    [SOLANA_ERROR__INSTRUCTION_ERROR__MODIFIED_PROGRAM_ID]: "instruction illegally modified the program id of an account",
    [SOLANA_ERROR__INSTRUCTION_ERROR__NOT_ENOUGH_ACCOUNT_KEYS]: "insufficient account keys for instruction",
    [SOLANA_ERROR__INSTRUCTION_ERROR__PRIVILEGE_ESCALATION]: "Cross-program invocation with unauthorized signer or writable account",
    [SOLANA_ERROR__INSTRUCTION_ERROR__PROGRAM_ENVIRONMENT_SETUP_FAILURE]: "Failed to create program execution environment",
    [SOLANA_ERROR__INSTRUCTION_ERROR__PROGRAM_FAILED_TO_COMPILE]: "Program failed to compile",
    [SOLANA_ERROR__INSTRUCTION_ERROR__PROGRAM_FAILED_TO_COMPLETE]: "Program failed to complete",
    [SOLANA_ERROR__INSTRUCTION_ERROR__READONLY_DATA_MODIFIED]: "instruction modified data of a read-only account",
    [SOLANA_ERROR__INSTRUCTION_ERROR__READONLY_LAMPORT_CHANGE]: "instruction changed the balance of a read-only account",
    [SOLANA_ERROR__INSTRUCTION_ERROR__REENTRANCY_NOT_ALLOWED]: "Cross-program invocation reentrancy not allowed for this instruction",
    [SOLANA_ERROR__INSTRUCTION_ERROR__RENT_EPOCH_MODIFIED]: "instruction modified rent epoch of an account",
    [SOLANA_ERROR__INSTRUCTION_ERROR__UNBALANCED_INSTRUCTION]: "sum of account balances before and after instruction do not match",
    [SOLANA_ERROR__INSTRUCTION_ERROR__UNINITIALIZED_ACCOUNT]: "instruction requires an initialized account",
    [SOLANA_ERROR__INSTRUCTION_ERROR__UNKNOWN]: "",
    [SOLANA_ERROR__INSTRUCTION_ERROR__UNSUPPORTED_PROGRAM_ID]: "Unsupported program id",
    [SOLANA_ERROR__INSTRUCTION_ERROR__UNSUPPORTED_SYSVAR]: "Unsupported sysvar",
    [SOLANA_ERROR__INSTRUCTION__EXPECTED_TO_HAVE_ACCOUNTS]: "The instruction does not have any accounts.",
    [SOLANA_ERROR__INSTRUCTION__EXPECTED_TO_HAVE_DATA]: "The instruction does not have any data.",
    [SOLANA_ERROR__INSTRUCTION__PROGRAM_ID_MISMATCH]: "Expected instruction to have progress address $expectedProgramAddress, got $actualProgramAddress.",
    [SOLANA_ERROR__INVALID_BLOCKHASH_BYTE_LENGTH]: "Expected base58 encoded blockhash to decode to a byte array of length 32. Actual length: $actualLength.",
    [SOLANA_ERROR__INVALID_NONCE]: "The nonce `$expectedNonceValue` is no longer valid. It has advanced to `$actualNonceValue`",
    [SOLANA_ERROR__INVARIANT_VIOLATION__CACHED_ABORTABLE_ITERABLE_CACHE_ENTRY_MISSING]: "Invariant violation: Found no abortable iterable cache entry for key `$cacheKey`. It should be impossible to hit this error; please file an issue at https://sola.na/web3invariant",
    [SOLANA_ERROR__INVARIANT_VIOLATION__DATA_PUBLISHER_CHANNEL_UNIMPLEMENTED]: "Invariant violation: This data publisher does not publish to the channel named `$channelName`. Supported channels include $supportedChannelNames.",
    [SOLANA_ERROR__INVARIANT_VIOLATION__SUBSCRIPTION_ITERATOR_MUST_NOT_POLL_BEFORE_RESOLVING_EXISTING_MESSAGE_PROMISE]: "Invariant violation: WebSocket message iterator state is corrupt; iterated without first resolving existing message promise. It should be impossible to hit this error; please file an issue at https://sola.na/web3invariant",
    [SOLANA_ERROR__INVARIANT_VIOLATION__SUBSCRIPTION_ITERATOR_STATE_MISSING]: "Invariant violation: WebSocket message iterator is missing state storage. It should be impossible to hit this error; please file an issue at https://sola.na/web3invariant",
    [SOLANA_ERROR__INVARIANT_VIOLATION__SWITCH_MUST_BE_EXHAUSTIVE]: "Invariant violation: Switch statement non-exhaustive. Received unexpected value `$unexpectedValue`. It should be impossible to hit this error; please file an issue at https://sola.na/web3invariant",
    [SOLANA_ERROR__JSON_RPC__INTERNAL_ERROR]: "JSON-RPC error: Internal JSON-RPC error ($__serverMessage)",
    [SOLANA_ERROR__JSON_RPC__INVALID_PARAMS]: "JSON-RPC error: Invalid method parameter(s) ($__serverMessage)",
    [SOLANA_ERROR__JSON_RPC__INVALID_REQUEST]: "JSON-RPC error: The JSON sent is not a valid `Request` object ($__serverMessage)",
    [SOLANA_ERROR__JSON_RPC__METHOD_NOT_FOUND]: "JSON-RPC error: The method does not exist / is not available ($__serverMessage)",
    [SOLANA_ERROR__JSON_RPC__PARSE_ERROR]: "JSON-RPC error: An error occurred on the server while parsing the JSON text ($__serverMessage)",
    [SOLANA_ERROR__JSON_RPC__SCAN_ERROR]: "$__serverMessage",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_BLOCK_CLEANED_UP]: "$__serverMessage",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_BLOCK_NOT_AVAILABLE]: "$__serverMessage",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_BLOCK_STATUS_NOT_AVAILABLE_YET]: "$__serverMessage",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_KEY_EXCLUDED_FROM_SECONDARY_INDEX]: "$__serverMessage",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_LONG_TERM_STORAGE_SLOT_SKIPPED]: "$__serverMessage",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_MIN_CONTEXT_SLOT_NOT_REACHED]: "Minimum context slot has not been reached",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_NODE_UNHEALTHY]: "Node is unhealthy; behind by $numSlotsBehind slots",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_NO_SNAPSHOT]: "No snapshot",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE]: "Transaction simulation failed",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SLOT_SKIPPED]: "$__serverMessage",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_TRANSACTION_HISTORY_NOT_AVAILABLE]: "Transaction history is not available from this node",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_TRANSACTION_PRECOMPILE_VERIFICATION_FAILURE]: "$__serverMessage",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_TRANSACTION_SIGNATURE_LEN_MISMATCH]: "Transaction signature length mismatch",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_TRANSACTION_SIGNATURE_VERIFICATION_FAILURE]: "Transaction signature verification failure",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_UNSUPPORTED_TRANSACTION_VERSION]: "$__serverMessage",
    [SOLANA_ERROR__KEYS__INVALID_KEY_PAIR_BYTE_LENGTH]: "Key pair bytes must be of length 64, got $byteLength.",
    [SOLANA_ERROR__KEYS__INVALID_PRIVATE_KEY_BYTE_LENGTH]: "Expected private key bytes with length 32. Actual length: $actualLength.",
    [SOLANA_ERROR__KEYS__INVALID_SIGNATURE_BYTE_LENGTH]: "Expected base58-encoded signature to decode to a byte array of length 64. Actual length: $actualLength.",
    [SOLANA_ERROR__KEYS__PUBLIC_KEY_MUST_MATCH_PRIVATE_KEY]: "The provided private key does not match the provided public key.",
    [SOLANA_ERROR__KEYS__SIGNATURE_STRING_LENGTH_OUT_OF_RANGE]: "Expected base58-encoded signature string of length in the range [64, 88]. Actual length: $actualLength.",
    [SOLANA_ERROR__LAMPORTS_OUT_OF_RANGE]: "Lamports value must be in the range [0, 2e64-1]",
    [SOLANA_ERROR__MALFORMED_BIGINT_STRING]: "`$value` cannot be parsed as a `BigInt`",
    [SOLANA_ERROR__MALFORMED_NUMBER_STRING]: "`$value` cannot be parsed as a `Number`",
    [SOLANA_ERROR__NONCE_ACCOUNT_NOT_FOUND]: "No nonce account could be found at address `$nonceAccountAddress`",
    [SOLANA_ERROR__RPC_SUBSCRIPTIONS__CANNOT_CREATE_SUBSCRIPTION_PLAN]: "The notification name must end in 'Notifications' and the API must supply a subscription plan creator function for the notification '$notificationName'.",
    [SOLANA_ERROR__RPC_SUBSCRIPTIONS__CHANNEL_CLOSED_BEFORE_MESSAGE_BUFFERED]: "WebSocket was closed before payload could be added to the send buffer",
    [SOLANA_ERROR__RPC_SUBSCRIPTIONS__CHANNEL_CONNECTION_CLOSED]: "WebSocket connection closed",
    [SOLANA_ERROR__RPC_SUBSCRIPTIONS__CHANNEL_FAILED_TO_CONNECT]: "WebSocket failed to connect",
    [SOLANA_ERROR__RPC_SUBSCRIPTIONS__EXPECTED_SERVER_SUBSCRIPTION_ID]: "Failed to obtain a subscription id from the server",
    [SOLANA_ERROR__RPC__API_PLAN_MISSING_FOR_RPC_METHOD]: "Could not find an API plan for RPC method: `$method`",
    [SOLANA_ERROR__RPC__INTEGER_OVERFLOW]: "The $argumentLabel argument to the `$methodName` RPC method$optionalPathLabel was `$value`. This number is unsafe for use with the Solana JSON-RPC because it exceeds `Number.MAX_SAFE_INTEGER`.",
    [SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR]: "HTTP error ($statusCode): $message",
    [SOLANA_ERROR__RPC__TRANSPORT_HTTP_HEADER_FORBIDDEN]: "HTTP header(s) forbidden: $headers. Learn more at https://developer.mozilla.org/en-US/docs/Glossary/Forbidden_header_name.",
    [SOLANA_ERROR__SIGNER__ADDRESS_CANNOT_HAVE_MULTIPLE_SIGNERS]: "Multiple distinct signers were identified for address `$address`. Please ensure that you are using the same signer instance for each address.",
    [SOLANA_ERROR__SIGNER__EXPECTED_KEY_PAIR_SIGNER]: "The provided value does not implement the `KeyPairSigner` interface",
    [SOLANA_ERROR__SIGNER__EXPECTED_MESSAGE_MODIFYING_SIGNER]: "The provided value does not implement the `MessageModifyingSigner` interface",
    [SOLANA_ERROR__SIGNER__EXPECTED_MESSAGE_PARTIAL_SIGNER]: "The provided value does not implement the `MessagePartialSigner` interface",
    [SOLANA_ERROR__SIGNER__EXPECTED_MESSAGE_SIGNER]: "The provided value does not implement any of the `MessageSigner` interfaces",
    [SOLANA_ERROR__SIGNER__EXPECTED_TRANSACTION_MODIFYING_SIGNER]: "The provided value does not implement the `TransactionModifyingSigner` interface",
    [SOLANA_ERROR__SIGNER__EXPECTED_TRANSACTION_PARTIAL_SIGNER]: "The provided value does not implement the `TransactionPartialSigner` interface",
    [SOLANA_ERROR__SIGNER__EXPECTED_TRANSACTION_SENDING_SIGNER]: "The provided value does not implement the `TransactionSendingSigner` interface",
    [SOLANA_ERROR__SIGNER__EXPECTED_TRANSACTION_SIGNER]: "The provided value does not implement any of the `TransactionSigner` interfaces",
    [SOLANA_ERROR__SIGNER__TRANSACTION_CANNOT_HAVE_MULTIPLE_SENDING_SIGNERS]: "More than one `TransactionSendingSigner` was identified.",
    [SOLANA_ERROR__SIGNER__TRANSACTION_SENDING_SIGNER_MISSING]: "No `TransactionSendingSigner` was identified. Please provide a valid `ITransactionWithSingleSendingSigner` transaction.",
    [SOLANA_ERROR__SIGNER__WALLET_MULTISIGN_UNIMPLEMENTED]: "Wallet account signers do not support signing multiple messages/transactions in a single operation",
    [SOLANA_ERROR__SUBTLE_CRYPTO__CANNOT_EXPORT_NON_EXTRACTABLE_KEY]: "Cannot export a non-extractable key.",
    [SOLANA_ERROR__SUBTLE_CRYPTO__DIGEST_UNIMPLEMENTED]: "No digest implementation could be found.",
    [SOLANA_ERROR__SUBTLE_CRYPTO__DISALLOWED_IN_INSECURE_CONTEXT]: "Cryptographic operations are only allowed in secure browser contexts. Read more here: https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts.",
    [SOLANA_ERROR__SUBTLE_CRYPTO__ED25519_ALGORITHM_UNIMPLEMENTED]: "This runtime does not support the generation of Ed25519 key pairs.\n\nInstall @solana/webcrypto-ed25519-polyfill and call its `install` function before generating keys in environments that do not support Ed25519.\n\nFor a list of runtimes that currently support Ed25519 operations, visit https://github.com/WICG/webcrypto-secure-curves/issues/20.",
    [SOLANA_ERROR__SUBTLE_CRYPTO__EXPORT_FUNCTION_UNIMPLEMENTED]: "No signature verification implementation could be found.",
    [SOLANA_ERROR__SUBTLE_CRYPTO__GENERATE_FUNCTION_UNIMPLEMENTED]: "No key generation implementation could be found.",
    [SOLANA_ERROR__SUBTLE_CRYPTO__SIGN_FUNCTION_UNIMPLEMENTED]: "No signing implementation could be found.",
    [SOLANA_ERROR__SUBTLE_CRYPTO__VERIFY_FUNCTION_UNIMPLEMENTED]: "No key export implementation could be found.",
    [SOLANA_ERROR__TIMESTAMP_OUT_OF_RANGE]: "Timestamp value must be in the range [-(2n ** 63n), (2n ** 63n) - 1]. `$value` given",
    [SOLANA_ERROR__TRANSACTION_ERROR__ACCOUNT_BORROW_OUTSTANDING]: "Transaction processing left an account with an outstanding borrowed reference",
    [SOLANA_ERROR__TRANSACTION_ERROR__ACCOUNT_IN_USE]: "Account in use",
    [SOLANA_ERROR__TRANSACTION_ERROR__ACCOUNT_LOADED_TWICE]: "Account loaded twice",
    [SOLANA_ERROR__TRANSACTION_ERROR__ACCOUNT_NOT_FOUND]: "Attempt to debit an account but found no record of a prior credit.",
    [SOLANA_ERROR__TRANSACTION_ERROR__ADDRESS_LOOKUP_TABLE_NOT_FOUND]: "Transaction loads an address table account that doesn't exist",
    [SOLANA_ERROR__TRANSACTION_ERROR__ALREADY_PROCESSED]: "This transaction has already been processed",
    [SOLANA_ERROR__TRANSACTION_ERROR__BLOCKHASH_NOT_FOUND]: "Blockhash not found",
    [SOLANA_ERROR__TRANSACTION_ERROR__CALL_CHAIN_TOO_DEEP]: "Loader call chain is too deep",
    [SOLANA_ERROR__TRANSACTION_ERROR__CLUSTER_MAINTENANCE]: "Transactions are currently disabled due to cluster maintenance",
    [SOLANA_ERROR__TRANSACTION_ERROR__DUPLICATE_INSTRUCTION]: "Transaction contains a duplicate instruction ($index) that is not allowed",
    [SOLANA_ERROR__TRANSACTION_ERROR__INSUFFICIENT_FUNDS_FOR_FEE]: "Insufficient funds for fee",
    [SOLANA_ERROR__TRANSACTION_ERROR__INSUFFICIENT_FUNDS_FOR_RENT]: "Transaction results in an account ($accountIndex) with insufficient funds for rent",
    [SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ACCOUNT_FOR_FEE]: "This account may not be used to pay transaction fees",
    [SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ACCOUNT_INDEX]: "Transaction contains an invalid account reference",
    [SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ADDRESS_LOOKUP_TABLE_DATA]: "Transaction loads an address table account with invalid data",
    [SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ADDRESS_LOOKUP_TABLE_INDEX]: "Transaction address table lookup uses an invalid index",
    [SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ADDRESS_LOOKUP_TABLE_OWNER]: "Transaction loads an address table account with an invalid owner",
    [SOLANA_ERROR__TRANSACTION_ERROR__INVALID_LOADED_ACCOUNTS_DATA_SIZE_LIMIT]: "LoadedAccountsDataSizeLimit set for transaction must be greater than 0.",
    [SOLANA_ERROR__TRANSACTION_ERROR__INVALID_PROGRAM_FOR_EXECUTION]: "This program may not be used for executing instructions",
    [SOLANA_ERROR__TRANSACTION_ERROR__INVALID_RENT_PAYING_ACCOUNT]: "Transaction leaves an account with a lower balance than rent-exempt minimum",
    [SOLANA_ERROR__TRANSACTION_ERROR__INVALID_WRITABLE_ACCOUNT]: "Transaction loads a writable account that cannot be written",
    [SOLANA_ERROR__TRANSACTION_ERROR__MAX_LOADED_ACCOUNTS_DATA_SIZE_EXCEEDED]: "Transaction exceeded max loaded accounts data size cap",
    [SOLANA_ERROR__TRANSACTION_ERROR__MISSING_SIGNATURE_FOR_FEE]: "Transaction requires a fee but has no signature present",
    [SOLANA_ERROR__TRANSACTION_ERROR__PROGRAM_ACCOUNT_NOT_FOUND]: "Attempt to load a program that does not exist",
    [SOLANA_ERROR__TRANSACTION_ERROR__PROGRAM_EXECUTION_TEMPORARILY_RESTRICTED]: "Execution of the program referenced by account at index $accountIndex is temporarily restricted.",
    [SOLANA_ERROR__TRANSACTION_ERROR__RESANITIZATION_NEEDED]: "ResanitizationNeeded",
    [SOLANA_ERROR__TRANSACTION_ERROR__SANITIZE_FAILURE]: "Transaction failed to sanitize accounts offsets correctly",
    [SOLANA_ERROR__TRANSACTION_ERROR__SIGNATURE_FAILURE]: "Transaction did not pass signature verification",
    [SOLANA_ERROR__TRANSACTION_ERROR__TOO_MANY_ACCOUNT_LOCKS]: "Transaction locked too many accounts",
    [SOLANA_ERROR__TRANSACTION_ERROR__UNBALANCED_TRANSACTION]: "Sum of account balances before and after transaction do not match",
    [SOLANA_ERROR__TRANSACTION_ERROR__UNKNOWN]: "The transaction failed with the error `$errorName`",
    [SOLANA_ERROR__TRANSACTION_ERROR__UNSUPPORTED_VERSION]: "Transaction version is unsupported",
    [SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_ACCOUNT_DATA_BLOCK_LIMIT]: "Transaction would exceed account data limit within the block",
    [SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_ACCOUNT_DATA_TOTAL_LIMIT]: "Transaction would exceed total account data limit",
    [SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_MAX_ACCOUNT_COST_LIMIT]: "Transaction would exceed max account limit within the block",
    [SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_MAX_BLOCK_COST_LIMIT]: "Transaction would exceed max Block Cost Limit",
    [SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_MAX_VOTE_COST_LIMIT]: "Transaction would exceed max Vote Cost Limit",
    [SOLANA_ERROR__TRANSACTION__ADDRESSES_CANNOT_SIGN_TRANSACTION]: "Attempted to sign a transaction with an address that is not a signer for it",
    [SOLANA_ERROR__TRANSACTION__ADDRESS_MISSING]: "Transaction is missing an address at index: $index.",
    [SOLANA_ERROR__TRANSACTION__CANNOT_ENCODE_WITH_EMPTY_SIGNATURES]: "Transaction has no expected signers therefore it cannot be encoded",
    [SOLANA_ERROR__TRANSACTION__EXPECTED_BLOCKHASH_LIFETIME]: "Transaction does not have a blockhash lifetime",
    [SOLANA_ERROR__TRANSACTION__EXPECTED_NONCE_LIFETIME]: "Transaction is not a durable nonce transaction",
    [SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_ADDRESS_LOOKUP_TABLE_CONTENTS_MISSING]: "Contents of these address lookup tables unknown: $lookupTableAddresses",
    [SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_ADDRESS_LOOKUP_TABLE_INDEX_OUT_OF_RANGE]: "Lookup of address at index $highestRequestedIndex failed for lookup table `$lookupTableAddress`. Highest known index is $highestKnownIndex. The lookup table may have been extended since its contents were retrieved",
    [SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_FEE_PAYER_MISSING]: "No fee payer set in CompiledTransaction",
    [SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_INSTRUCTION_PROGRAM_ADDRESS_NOT_FOUND]: "Could not find program address at index $index",
    [SOLANA_ERROR__TRANSACTION__FAILED_TO_ESTIMATE_COMPUTE_LIMIT]: "Failed to estimate the compute unit consumption for this transaction message. This is likely because simulating the transaction failed. Inspect the `cause` property of this error to learn more",
    [SOLANA_ERROR__TRANSACTION__FAILED_WHEN_SIMULATING_TO_ESTIMATE_COMPUTE_LIMIT]: "Transaction failed when it was simulated in order to estimate the compute unit consumption. The compute unit estimate provided is for a transaction that failed when simulated and may not be representative of the compute units this transaction would consume if successful. Inspect the `cause` property of this error to learn more",
    [SOLANA_ERROR__TRANSACTION__FEE_PAYER_MISSING]: "Transaction is missing a fee payer.",
    [SOLANA_ERROR__TRANSACTION__FEE_PAYER_SIGNATURE_MISSING]: "Could not determine this transaction's signature. Make sure that the transaction has been signed by its fee payer.",
    [SOLANA_ERROR__TRANSACTION__INVALID_NONCE_TRANSACTION_FIRST_INSTRUCTION_MUST_BE_ADVANCE_NONCE]: "Transaction first instruction is not advance nonce account instruction.",
    [SOLANA_ERROR__TRANSACTION__INVALID_NONCE_TRANSACTION_INSTRUCTIONS_MISSING]: "Transaction with no instructions cannot be durable nonce transaction.",
    [SOLANA_ERROR__TRANSACTION__INVOKED_PROGRAMS_CANNOT_PAY_FEES]: "This transaction includes an address (`$programAddress`) which is both invoked and set as the fee payer. Program addresses may not pay fees",
    [SOLANA_ERROR__TRANSACTION__INVOKED_PROGRAMS_MUST_NOT_BE_WRITABLE]: "This transaction includes an address (`$programAddress`) which is both invoked and marked writable. Program addresses may not be writable",
    [SOLANA_ERROR__TRANSACTION__MESSAGE_SIGNATURES_MISMATCH]: "The transaction message expected the transaction to have $signerAddressesLength signatures, got $signaturesLength.",
    [SOLANA_ERROR__TRANSACTION__SIGNATURES_MISSING]: "Transaction is missing signatures for addresses: $addresses.",
    [SOLANA_ERROR__TRANSACTION__VERSION_NUMBER_OUT_OF_RANGE]: "Transaction version must be in the range [0, 127]. `$actualVersion` given"
  };
  var START_INDEX = "i";
  var TYPE = "t";

  function getHumanReadableErrorMessage(code, context = {}) {
    const messageFormatString = SolanaErrorMessages[code];
    if(messageFormatString.length === 0) {
      return "";
    }
    let state;

    function commitStateUpTo(endIndex) {
      if(state[TYPE] === 2) {
        const variableName = messageFormatString.slice(state[START_INDEX] + 1, endIndex);
        fragments.push(
          variableName in context ? `${context[variableName]}` : `$${variableName}`
        );
      }
      else if(state[TYPE] === 1) {
        fragments.push(messageFormatString.slice(state[START_INDEX], endIndex));
      }
    }

    const fragments = [];
    messageFormatString.split("").forEach((char, ii) => {
      if(ii === 0) {
        state = {
          [START_INDEX]: 0,
          [TYPE]: messageFormatString[0] === "\\" ? 0 : messageFormatString[0] === "$" ? 2 : 1
          /* Text */
        };
        return;
      }
      let nextState;
      switch(state[TYPE]) {
        case 0:
          nextState = {
            [START_INDEX]: ii,
            [TYPE]: 1
            /* Text */
          };
          break;
        case 1:
          if(char === "\\") {
            nextState = {
              [START_INDEX]: ii,
              [TYPE]: 0
              /* EscapeSequence */
            };
          }
          else if(char === "$") {
            nextState = {
              [START_INDEX]: ii,
              [TYPE]: 2
              /* Variable */
            };
          }
          break;
        case 2:
          if(char === "\\") {
            nextState = {
              [START_INDEX]: ii,
              [TYPE]: 0
              /* EscapeSequence */
            };
          }
          else if(char === "$") {
            nextState = {
              [START_INDEX]: ii,
              [TYPE]: 2
              /* Variable */
            };
          }
          else if(!char.match(/\w/)) {
            nextState = {
              [START_INDEX]: ii,
              [TYPE]: 1
              /* Text */
            };
          }
          break;
      }
      if(nextState) {
        if(state !== nextState) {
          commitStateUpTo(ii);
        }
        state = nextState;
      }
    });
    commitStateUpTo();
    return fragments.join("");
  }

  function getErrorMessage(code, context = {}) {
    {
      return getHumanReadableErrorMessage(code, context);
    }
  }

  function isSolanaError(e3, code) {
    const isSolanaError2 = e3 instanceof Error && e3.name === "SolanaError";
    if(isSolanaError2) {
      if(code !== void 0) {
        return e3.context.__code === code;
      }
      return true;
    }
    return false;
  }

  var SolanaError = class extends Error {
    constructor(...[code, contextAndErrorOptions]) {
      let context;
      let errorOptions;
      if(contextAndErrorOptions) {
        const {cause, ...contextRest} = contextAndErrorOptions;
        if(cause) {
          errorOptions = {cause};
        }
        if(Object.keys(contextRest).length > 0) {
          context = contextRest;
        }
      }
      const message = getErrorMessage(code, context);
      super(message, errorOptions);
      __publicField(this, "cause", this.cause);
      __publicField(this, "context");
      this.context = {
        __code: code,
        ...context
      };
      this.name = "SolanaError";
    }
  };

  function safeCaptureStackTrace(...args) {
    if("captureStackTrace" in Error && typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(...args);
    }
  }

  function getSolanaErrorFromRpcError({
    errorCodeBaseOffset,
    getErrorContext,
    orderedErrorNames,
    rpcEnumError
  }, constructorOpt) {
    let rpcErrorName;
    let rpcErrorContext;
    if(typeof rpcEnumError === "string") {
      rpcErrorName = rpcEnumError;
    }
    else {
      rpcErrorName = Object.keys(rpcEnumError)[0];
      rpcErrorContext = rpcEnumError[rpcErrorName];
    }
    const codeOffset = orderedErrorNames.indexOf(rpcErrorName);
    const errorCode = errorCodeBaseOffset + codeOffset;
    const errorContext = getErrorContext(errorCode, rpcErrorName, rpcErrorContext);
    const err = new SolanaError(errorCode, errorContext);
    safeCaptureStackTrace(err, constructorOpt);
    return err;
  }

  var ORDERED_ERROR_NAMES = [
    // Keep synced with RPC source: https://github.com/anza-xyz/agave/blob/master/sdk/program/src/instruction.rs
    // If this list ever gets too large, consider implementing a compression strategy like this:
    // https://gist.github.com/steveluscher/aaa7cbbb5433b1197983908a40860c47
    "GenericError",
    "InvalidArgument",
    "InvalidInstructionData",
    "InvalidAccountData",
    "AccountDataTooSmall",
    "InsufficientFunds",
    "IncorrectProgramId",
    "MissingRequiredSignature",
    "AccountAlreadyInitialized",
    "UninitializedAccount",
    "UnbalancedInstruction",
    "ModifiedProgramId",
    "ExternalAccountLamportSpend",
    "ExternalAccountDataModified",
    "ReadonlyLamportChange",
    "ReadonlyDataModified",
    "DuplicateAccountIndex",
    "ExecutableModified",
    "RentEpochModified",
    "NotEnoughAccountKeys",
    "AccountDataSizeChanged",
    "AccountNotExecutable",
    "AccountBorrowFailed",
    "AccountBorrowOutstanding",
    "DuplicateAccountOutOfSync",
    "Custom",
    "InvalidError",
    "ExecutableDataModified",
    "ExecutableLamportChange",
    "ExecutableAccountNotRentExempt",
    "UnsupportedProgramId",
    "CallDepth",
    "MissingAccount",
    "ReentrancyNotAllowed",
    "MaxSeedLengthExceeded",
    "InvalidSeeds",
    "InvalidRealloc",
    "ComputationalBudgetExceeded",
    "PrivilegeEscalation",
    "ProgramEnvironmentSetupFailure",
    "ProgramFailedToComplete",
    "ProgramFailedToCompile",
    "Immutable",
    "IncorrectAuthority",
    "BorshIoError",
    "AccountNotRentExempt",
    "InvalidAccountOwner",
    "ArithmeticOverflow",
    "UnsupportedSysvar",
    "IllegalOwner",
    "MaxAccountsDataAllocationsExceeded",
    "MaxAccountsExceeded",
    "MaxInstructionTraceLengthExceeded",
    "BuiltinProgramsMustConsumeComputeUnits"
  ];

  function getSolanaErrorFromInstructionError(index, instructionError) {
    const numberIndex = Number(index);
    return getSolanaErrorFromRpcError(
      {
        errorCodeBaseOffset: 4615001,
        getErrorContext(errorCode, rpcErrorName, rpcErrorContext) {
          if(errorCode === SOLANA_ERROR__INSTRUCTION_ERROR__UNKNOWN) {
            return {
              errorName: rpcErrorName,
              index: numberIndex,
              ...rpcErrorContext !== void 0 ? {instructionErrorContext: rpcErrorContext} : null
            };
          }
          else if(errorCode === SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM) {
            return {
              code: Number(rpcErrorContext),
              index: numberIndex
            };
          }
          else if(errorCode === SOLANA_ERROR__INSTRUCTION_ERROR__BORSH_IO_ERROR) {
            return {
              encodedData: rpcErrorContext,
              index: numberIndex
            };
          }
          return {index: numberIndex};
        },
        orderedErrorNames: ORDERED_ERROR_NAMES,
        rpcEnumError: instructionError
      },
      getSolanaErrorFromInstructionError
    );
  }

  var ORDERED_ERROR_NAMES2 = [
    // Keep synced with RPC source: https://github.com/anza-xyz/agave/blob/master/sdk/src/transaction/error.rs
    // If this list ever gets too large, consider implementing a compression strategy like this:
    // https://gist.github.com/steveluscher/aaa7cbbb5433b1197983908a40860c47
    "AccountInUse",
    "AccountLoadedTwice",
    "AccountNotFound",
    "ProgramAccountNotFound",
    "InsufficientFundsForFee",
    "InvalidAccountForFee",
    "AlreadyProcessed",
    "BlockhashNotFound",
    // `InstructionError` intentionally omitted; delegated to `getSolanaErrorFromInstructionError`
    "CallChainTooDeep",
    "MissingSignatureForFee",
    "InvalidAccountIndex",
    "SignatureFailure",
    "InvalidProgramForExecution",
    "SanitizeFailure",
    "ClusterMaintenance",
    "AccountBorrowOutstanding",
    "WouldExceedMaxBlockCostLimit",
    "UnsupportedVersion",
    "InvalidWritableAccount",
    "WouldExceedMaxAccountCostLimit",
    "WouldExceedAccountDataBlockLimit",
    "TooManyAccountLocks",
    "AddressLookupTableNotFound",
    "InvalidAddressLookupTableOwner",
    "InvalidAddressLookupTableData",
    "InvalidAddressLookupTableIndex",
    "InvalidRentPayingAccount",
    "WouldExceedMaxVoteCostLimit",
    "WouldExceedAccountDataTotalLimit",
    "DuplicateInstruction",
    "InsufficientFundsForRent",
    "MaxLoadedAccountsDataSizeExceeded",
    "InvalidLoadedAccountsDataSizeLimit",
    "ResanitizationNeeded",
    "ProgramExecutionTemporarilyRestricted",
    "UnbalancedTransaction"
  ];

  function getSolanaErrorFromTransactionError(transactionError) {
    if(typeof transactionError === "object" && "InstructionError" in transactionError) {
      return getSolanaErrorFromInstructionError(
        ...transactionError.InstructionError
      );
    }
    return getSolanaErrorFromRpcError(
      {
        errorCodeBaseOffset: 7050001,
        getErrorContext(errorCode, rpcErrorName, rpcErrorContext) {
          if(errorCode === SOLANA_ERROR__TRANSACTION_ERROR__UNKNOWN) {
            return {
              errorName: rpcErrorName,
              ...rpcErrorContext !== void 0 ? {transactionErrorContext: rpcErrorContext} : null
            };
          }
          else if(errorCode === SOLANA_ERROR__TRANSACTION_ERROR__DUPLICATE_INSTRUCTION) {
            return {
              index: Number(rpcErrorContext)
            };
          }
          else if(errorCode === SOLANA_ERROR__TRANSACTION_ERROR__INSUFFICIENT_FUNDS_FOR_RENT || errorCode === SOLANA_ERROR__TRANSACTION_ERROR__PROGRAM_EXECUTION_TEMPORARILY_RESTRICTED) {
            return {
              accountIndex: Number(rpcErrorContext.account_index)
            };
          }
        },
        orderedErrorNames: ORDERED_ERROR_NAMES2,
        rpcEnumError: transactionError
      },
      getSolanaErrorFromTransactionError
    );
  }

  function getSolanaErrorFromJsonRpcError({code: rawCode, data, message}) {
    let out;
    const code = Number(rawCode);
    if(code === SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE) {
      const {err, ...preflightErrorContext} = data;
      const causeObject = err ? {cause: getSolanaErrorFromTransactionError(err)} : null;
      out = new SolanaError(SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE, {
        ...preflightErrorContext,
        ...causeObject
      });
    }
    else {
      let errorContext;
      switch(code) {
        case SOLANA_ERROR__JSON_RPC__INTERNAL_ERROR:
        case SOLANA_ERROR__JSON_RPC__INVALID_PARAMS:
        case SOLANA_ERROR__JSON_RPC__INVALID_REQUEST:
        case SOLANA_ERROR__JSON_RPC__METHOD_NOT_FOUND:
        case SOLANA_ERROR__JSON_RPC__PARSE_ERROR:
        case SOLANA_ERROR__JSON_RPC__SCAN_ERROR:
        case SOLANA_ERROR__JSON_RPC__SERVER_ERROR_BLOCK_CLEANED_UP:
        case SOLANA_ERROR__JSON_RPC__SERVER_ERROR_BLOCK_NOT_AVAILABLE:
        case SOLANA_ERROR__JSON_RPC__SERVER_ERROR_BLOCK_STATUS_NOT_AVAILABLE_YET:
        case SOLANA_ERROR__JSON_RPC__SERVER_ERROR_KEY_EXCLUDED_FROM_SECONDARY_INDEX:
        case SOLANA_ERROR__JSON_RPC__SERVER_ERROR_LONG_TERM_STORAGE_SLOT_SKIPPED:
        case SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SLOT_SKIPPED:
        case SOLANA_ERROR__JSON_RPC__SERVER_ERROR_TRANSACTION_PRECOMPILE_VERIFICATION_FAILURE:
        case SOLANA_ERROR__JSON_RPC__SERVER_ERROR_UNSUPPORTED_TRANSACTION_VERSION:
          errorContext = {__serverMessage: message};
          break;
        default:
          if(typeof data === "object" && !Array.isArray(data)) {
            errorContext = data;
          }
      }
      out = new SolanaError(code, errorContext);
    }
    safeCaptureStackTrace(out, getSolanaErrorFromJsonRpcError);
    return out;
  }

  // ../codecs-core/dist/index.browser.mjs
  var mergeBytes = (byteArrays) => {
    const nonEmptyByteArrays = byteArrays.filter((arr) => arr.length);
    if(nonEmptyByteArrays.length === 0) {
      return byteArrays.length ? byteArrays[0] : new Uint8Array();
    }
    if(nonEmptyByteArrays.length === 1) {
      return nonEmptyByteArrays[0];
    }
    const totalLength = nonEmptyByteArrays.reduce((total, arr) => total + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    nonEmptyByteArrays.forEach((arr) => {
      result.set(arr, offset);
      offset += arr.length;
    });
    return result;
  };
  var padBytes = (bytes, length) => {
    if(bytes.length >= length) return bytes;
    const paddedBytes = new Uint8Array(length).fill(0);
    paddedBytes.set(bytes);
    return paddedBytes;
  };
  var fixBytes = (bytes, length) => padBytes(bytes.length <= length ? bytes : bytes.slice(0, length), length);

  function containsBytes(data, bytes, offset) {
    const slice = offset === 0 && data.length === bytes.length ? data : data.slice(offset, offset + bytes.length);
    if(slice.length !== bytes.length) return false;
    return bytes.every((b, i) => b === slice[i]);
  }

  function getEncodedSize(value, encoder) {
    return "fixedSize" in encoder ? encoder.fixedSize : encoder.getSizeFromValue(value);
  }

  function createEncoder(encoder) {
    return Object.freeze({
      ...encoder,
      encode: (value) => {
        const bytes = new Uint8Array(getEncodedSize(value, encoder));
        encoder.write(value, bytes, 0);
        return bytes;
      }
    });
  }

  function createDecoder(decoder) {
    return Object.freeze({
      ...decoder,
      decode: (bytes, offset = 0) => decoder.read(bytes, offset)[0]
    });
  }

  function createCodec(codec) {
    return Object.freeze({
      ...codec,
      decode: (bytes, offset = 0) => codec.read(bytes, offset)[0],
      encode: (value) => {
        const bytes = new Uint8Array(getEncodedSize(value, codec));
        codec.write(value, bytes, 0);
        return bytes;
      }
    });
  }

  function isFixedSize(codec) {
    return "fixedSize" in codec && typeof codec.fixedSize === "number";
  }

  function assertIsFixedSize(codec) {
    if(!isFixedSize(codec)) {
      throw new SolanaError(SOLANA_ERROR__CODECS__EXPECTED_FIXED_LENGTH);
    }
  }

  function isVariableSize(codec) {
    return !isFixedSize(codec);
  }

  function assertIsVariableSize(codec) {
    if(!isVariableSize(codec)) {
      throw new SolanaError(SOLANA_ERROR__CODECS__EXPECTED_VARIABLE_LENGTH);
    }
  }

  function combineCodec(encoder, decoder) {
    if(isFixedSize(encoder) !== isFixedSize(decoder)) {
      throw new SolanaError(SOLANA_ERROR__CODECS__ENCODER_DECODER_SIZE_COMPATIBILITY_MISMATCH);
    }
    if(isFixedSize(encoder) && isFixedSize(decoder) && encoder.fixedSize !== decoder.fixedSize) {
      throw new SolanaError(SOLANA_ERROR__CODECS__ENCODER_DECODER_FIXED_SIZE_MISMATCH, {
        decoderFixedSize: decoder.fixedSize,
        encoderFixedSize: encoder.fixedSize
      });
    }
    if(!isFixedSize(encoder) && !isFixedSize(decoder) && encoder.maxSize !== decoder.maxSize) {
      throw new SolanaError(SOLANA_ERROR__CODECS__ENCODER_DECODER_MAX_SIZE_MISMATCH, {
        decoderMaxSize: decoder.maxSize,
        encoderMaxSize: encoder.maxSize
      });
    }
    return {
      ...decoder,
      ...encoder,
      decode: decoder.decode,
      encode: encoder.encode,
      read: decoder.read,
      write: encoder.write
    };
  }

  function addEncoderSentinel(encoder, sentinel) {
    const write = (value, bytes, offset) => {
      const encoderBytes = encoder.encode(value);
      if(findSentinelIndex(encoderBytes, sentinel) >= 0) {
        throw new SolanaError(SOLANA_ERROR__CODECS__ENCODED_BYTES_MUST_NOT_INCLUDE_SENTINEL, {
          encodedBytes: encoderBytes,
          hexEncodedBytes: hexBytes(encoderBytes),
          hexSentinel: hexBytes(sentinel),
          sentinel
        });
      }
      bytes.set(encoderBytes, offset);
      offset += encoderBytes.length;
      bytes.set(sentinel, offset);
      offset += sentinel.length;
      return offset;
    };
    if(isFixedSize(encoder)) {
      return createEncoder({...encoder, fixedSize: encoder.fixedSize + sentinel.length, write});
    }
    return createEncoder({
      ...encoder,
      ...encoder.maxSize != null ? {maxSize: encoder.maxSize + sentinel.length} : {},
      getSizeFromValue: (value) => encoder.getSizeFromValue(value) + sentinel.length,
      write
    });
  }

  function addDecoderSentinel(decoder, sentinel) {
    const read = (bytes, offset) => {
      const candidateBytes = offset === 0 ? bytes : bytes.slice(offset);
      const sentinelIndex = findSentinelIndex(candidateBytes, sentinel);
      if(sentinelIndex === -1) {
        throw new SolanaError(SOLANA_ERROR__CODECS__SENTINEL_MISSING_IN_DECODED_BYTES, {
          decodedBytes: candidateBytes,
          hexDecodedBytes: hexBytes(candidateBytes),
          hexSentinel: hexBytes(sentinel),
          sentinel
        });
      }
      const preSentinelBytes = candidateBytes.slice(0, sentinelIndex);
      return [decoder.decode(preSentinelBytes), offset + preSentinelBytes.length + sentinel.length];
    };
    if(isFixedSize(decoder)) {
      return createDecoder({...decoder, fixedSize: decoder.fixedSize + sentinel.length, read});
    }
    return createDecoder({
      ...decoder,
      ...decoder.maxSize != null ? {maxSize: decoder.maxSize + sentinel.length} : {},
      read
    });
  }

  function addCodecSentinel(codec, sentinel) {
    return combineCodec(addEncoderSentinel(codec, sentinel), addDecoderSentinel(codec, sentinel));
  }

  function findSentinelIndex(bytes, sentinel) {
    return bytes.findIndex((byte, index, arr) => {
      if(sentinel.length === 1) return byte === sentinel[0];
      return containsBytes(arr, sentinel, index);
    });
  }

  function hexBytes(bytes) {
    return bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "");
  }

  function assertByteArrayIsNotEmptyForCodec(codecDescription, bytes, offset = 0) {
    if(bytes.length - offset <= 0) {
      throw new SolanaError(SOLANA_ERROR__CODECS__CANNOT_DECODE_EMPTY_BYTE_ARRAY, {
        codecDescription
      });
    }
  }

  function assertByteArrayHasEnoughBytesForCodec(codecDescription, expected, bytes, offset = 0) {
    const bytesLength = bytes.length - offset;
    if(bytesLength < expected) {
      throw new SolanaError(SOLANA_ERROR__CODECS__INVALID_BYTE_LENGTH, {
        bytesLength,
        codecDescription,
        expected
      });
    }
  }

  function assertByteArrayOffsetIsNotOutOfRange(codecDescription, offset, bytesLength) {
    if(offset < 0 || offset > bytesLength) {
      throw new SolanaError(SOLANA_ERROR__CODECS__OFFSET_OUT_OF_RANGE, {
        bytesLength,
        codecDescription,
        offset
      });
    }
  }

  function addEncoderSizePrefix(encoder, prefix) {
    var _a, _b;
    const write = (value, bytes, offset) => {
      const encoderBytes = encoder.encode(value);
      offset = prefix.write(encoderBytes.length, bytes, offset);
      bytes.set(encoderBytes, offset);
      return offset + encoderBytes.length;
    };
    if(isFixedSize(prefix) && isFixedSize(encoder)) {
      return createEncoder({...encoder, fixedSize: prefix.fixedSize + encoder.fixedSize, write});
    }
    const prefixMaxSize = isFixedSize(prefix) ? prefix.fixedSize : (_a = prefix.maxSize) != null ? _a : null;
    const encoderMaxSize = isFixedSize(encoder) ? encoder.fixedSize : (_b = encoder.maxSize) != null ? _b : null;
    const maxSize = prefixMaxSize !== null && encoderMaxSize !== null ? prefixMaxSize + encoderMaxSize : null;
    return createEncoder({
      ...encoder,
      ...maxSize !== null ? {maxSize} : {},
      getSizeFromValue: (value) => {
        const encoderSize = getEncodedSize(value, encoder);
        return getEncodedSize(encoderSize, prefix) + encoderSize;
      },
      write
    });
  }

  function addDecoderSizePrefix(decoder, prefix) {
    var _a, _b;
    const read = (bytes, offset) => {
      const [bigintSize, decoderOffset] = prefix.read(bytes, offset);
      const size = Number(bigintSize);
      offset = decoderOffset;
      if(offset > 0 || bytes.length > size) {
        bytes = bytes.slice(offset, offset + size);
      }
      assertByteArrayHasEnoughBytesForCodec("addDecoderSizePrefix", size, bytes);
      return [decoder.decode(bytes), offset + size];
    };
    if(isFixedSize(prefix) && isFixedSize(decoder)) {
      return createDecoder({...decoder, fixedSize: prefix.fixedSize + decoder.fixedSize, read});
    }
    const prefixMaxSize = isFixedSize(prefix) ? prefix.fixedSize : (_a = prefix.maxSize) != null ? _a : null;
    const decoderMaxSize = isFixedSize(decoder) ? decoder.fixedSize : (_b = decoder.maxSize) != null ? _b : null;
    const maxSize = prefixMaxSize !== null && decoderMaxSize !== null ? prefixMaxSize + decoderMaxSize : null;
    return createDecoder({...decoder, ...maxSize !== null ? {maxSize} : {}, read});
  }

  function addCodecSizePrefix(codec, prefix) {
    return combineCodec(addEncoderSizePrefix(codec, prefix), addDecoderSizePrefix(codec, prefix));
  }

  function fixEncoderSize(encoder, fixedBytes) {
    return createEncoder({
      fixedSize: fixedBytes,
      write: (value, bytes, offset) => {
        const variableByteArray = encoder.encode(value);
        const fixedByteArray = variableByteArray.length > fixedBytes ? variableByteArray.slice(0, fixedBytes) : variableByteArray;
        bytes.set(fixedByteArray, offset);
        return offset + fixedBytes;
      }
    });
  }

  function fixDecoderSize(decoder, fixedBytes) {
    return createDecoder({
      fixedSize: fixedBytes,
      read: (bytes, offset) => {
        assertByteArrayHasEnoughBytesForCodec("fixCodecSize", fixedBytes, bytes, offset);
        if(offset > 0 || bytes.length > fixedBytes) {
          bytes = bytes.slice(offset, offset + fixedBytes);
        }
        if(isFixedSize(decoder)) {
          bytes = fixBytes(bytes, decoder.fixedSize);
        }
        const [value] = decoder.read(bytes, 0);
        return [value, offset + fixedBytes];
      }
    });
  }

  function fixCodecSize(codec, fixedBytes) {
    return combineCodec(fixEncoderSize(codec, fixedBytes), fixDecoderSize(codec, fixedBytes));
  }

  function offsetEncoder(encoder, config) {
    return createEncoder({
      ...encoder,
      write: (value, bytes, preOffset) => {
        const wrapBytes = (offset) => modulo(offset, bytes.length);
        const newPreOffset = config.preOffset ? config.preOffset({bytes, preOffset, wrapBytes}) : preOffset;
        assertByteArrayOffsetIsNotOutOfRange("offsetEncoder", newPreOffset, bytes.length);
        const postOffset = encoder.write(value, bytes, newPreOffset);
        const newPostOffset = config.postOffset ? config.postOffset({
          bytes,
          newPreOffset,
          postOffset,
          preOffset,
          wrapBytes
        }) : postOffset;
        assertByteArrayOffsetIsNotOutOfRange("offsetEncoder", newPostOffset, bytes.length);
        return newPostOffset;
      }
    });
  }

  function offsetDecoder(decoder, config) {
    return createDecoder({
      ...decoder,
      read: (bytes, preOffset) => {
        const wrapBytes = (offset) => modulo(offset, bytes.length);
        const newPreOffset = config.preOffset ? config.preOffset({bytes, preOffset, wrapBytes}) : preOffset;
        assertByteArrayOffsetIsNotOutOfRange("offsetDecoder", newPreOffset, bytes.length);
        const [value, postOffset] = decoder.read(bytes, newPreOffset);
        const newPostOffset = config.postOffset ? config.postOffset({
          bytes,
          newPreOffset,
          postOffset,
          preOffset,
          wrapBytes
        }) : postOffset;
        assertByteArrayOffsetIsNotOutOfRange("offsetDecoder", newPostOffset, bytes.length);
        return [value, newPostOffset];
      }
    });
  }

  function offsetCodec(codec, config) {
    return combineCodec(offsetEncoder(codec, config), offsetDecoder(codec, config));
  }

  function modulo(dividend, divisor) {
    if(divisor === 0) return 0;
    return (dividend % divisor + divisor) % divisor;
  }

  function resizeEncoder(encoder, resize) {
    if(isFixedSize(encoder)) {
      const fixedSize = resize(encoder.fixedSize);
      if(fixedSize < 0) {
        throw new SolanaError(SOLANA_ERROR__CODECS__EXPECTED_POSITIVE_BYTE_LENGTH, {
          bytesLength: fixedSize,
          codecDescription: "resizeEncoder"
        });
      }
      return createEncoder({...encoder, fixedSize});
    }
    return createEncoder({
      ...encoder,
      getSizeFromValue: (value) => {
        const newSize = resize(encoder.getSizeFromValue(value));
        if(newSize < 0) {
          throw new SolanaError(SOLANA_ERROR__CODECS__EXPECTED_POSITIVE_BYTE_LENGTH, {
            bytesLength: newSize,
            codecDescription: "resizeEncoder"
          });
        }
        return newSize;
      }
    });
  }

  function resizeDecoder(decoder, resize) {
    if(isFixedSize(decoder)) {
      const fixedSize = resize(decoder.fixedSize);
      if(fixedSize < 0) {
        throw new SolanaError(SOLANA_ERROR__CODECS__EXPECTED_POSITIVE_BYTE_LENGTH, {
          bytesLength: fixedSize,
          codecDescription: "resizeDecoder"
        });
      }
      return createDecoder({...decoder, fixedSize});
    }
    return decoder;
  }

  function resizeCodec(codec, resize) {
    return combineCodec(resizeEncoder(codec, resize), resizeDecoder(codec, resize));
  }

  function padLeftEncoder(encoder, offset) {
    return offsetEncoder(
      resizeEncoder(encoder, (size) => size + offset),
      {preOffset: ({preOffset}) => preOffset + offset}
    );
  }

  function padRightEncoder(encoder, offset) {
    return offsetEncoder(
      resizeEncoder(encoder, (size) => size + offset),
      {postOffset: ({postOffset}) => postOffset + offset}
    );
  }

  function padLeftDecoder(decoder, offset) {
    return offsetDecoder(
      resizeDecoder(decoder, (size) => size + offset),
      {preOffset: ({preOffset}) => preOffset + offset}
    );
  }

  function padRightDecoder(decoder, offset) {
    return offsetDecoder(
      resizeDecoder(decoder, (size) => size + offset),
      {postOffset: ({postOffset}) => postOffset + offset}
    );
  }

  function padLeftCodec(codec, offset) {
    return combineCodec(padLeftEncoder(codec, offset), padLeftDecoder(codec, offset));
  }

  function padRightCodec(codec, offset) {
    return combineCodec(padRightEncoder(codec, offset), padRightDecoder(codec, offset));
  }

  function copySourceToTargetInReverse(source, target_WILL_MUTATE, sourceOffset, sourceLength, targetOffset = 0) {
    while(sourceOffset < --sourceLength) {
      const leftValue = source[sourceOffset];
      target_WILL_MUTATE[sourceOffset + targetOffset] = source[sourceLength];
      target_WILL_MUTATE[sourceLength + targetOffset] = leftValue;
      sourceOffset++;
    }
    if(sourceOffset === sourceLength) {
      target_WILL_MUTATE[sourceOffset + targetOffset] = source[sourceOffset];
    }
  }

  function reverseEncoder(encoder) {
    assertIsFixedSize(encoder);
    return createEncoder({
      ...encoder,
      write: (value, bytes, offset) => {
        const newOffset = encoder.write(value, bytes, offset);
        copySourceToTargetInReverse(
          bytes,
          bytes,
          offset,
          offset + encoder.fixedSize
        );
        return newOffset;
      }
    });
  }

  function reverseDecoder(decoder) {
    assertIsFixedSize(decoder);
    return createDecoder({
      ...decoder,
      read: (bytes, offset) => {
        const reversedBytes = bytes.slice();
        copySourceToTargetInReverse(
          bytes,
          reversedBytes,
          offset,
          offset + decoder.fixedSize
        );
        return decoder.read(reversedBytes, offset);
      }
    });
  }

  function reverseCodec(codec) {
    return combineCodec(reverseEncoder(codec), reverseDecoder(codec));
  }

  function transformEncoder(encoder, unmap) {
    return createEncoder({
      ...isVariableSize(encoder) ? {
        ...encoder,
        getSizeFromValue: (value) => encoder.getSizeFromValue(unmap(value))
      } : encoder,
      write: (value, bytes, offset) => encoder.write(unmap(value), bytes, offset)
    });
  }

  function transformDecoder(decoder, map) {
    return createDecoder({
      ...decoder,
      read: (bytes, offset) => {
        const [value, newOffset] = decoder.read(bytes, offset);
        return [map(value, bytes, offset), newOffset];
      }
    });
  }

  function transformCodec(codec, unmap, map) {
    return createCodec({
      ...transformEncoder(codec, unmap),
      read: map ? transformDecoder(codec, map).read : codec.read
    });
  }

  // ../codecs-strings/dist/index.browser.mjs
  function assertValidBaseString(alphabet4, testValue, givenValue = testValue) {
    if(!testValue.match(new RegExp(`^[${alphabet4}]*$`))) {
      throw new SolanaError(SOLANA_ERROR__CODECS__INVALID_STRING_FOR_BASE, {
        alphabet: alphabet4,
        base: alphabet4.length,
        value: givenValue
      });
    }
  }

  var getBaseXEncoder = (alphabet4) => {
    return createEncoder({
      getSizeFromValue: (value) => {
        const [leadingZeroes, tailChars] = partitionLeadingZeroes(value, alphabet4[0]);
        if(!tailChars) return value.length;
        const base10Number = getBigIntFromBaseX(tailChars, alphabet4);
        return leadingZeroes.length + Math.ceil(base10Number.toString(16).length / 2);
      },
      write(value, bytes, offset) {
        assertValidBaseString(alphabet4, value);
        if(value === "") return offset;
        const [leadingZeroes, tailChars] = partitionLeadingZeroes(value, alphabet4[0]);
        if(!tailChars) {
          bytes.set(new Uint8Array(leadingZeroes.length).fill(0), offset);
          return offset + leadingZeroes.length;
        }
        let base10Number = getBigIntFromBaseX(tailChars, alphabet4);
        const tailBytes = [];
        while(base10Number > 0n) {
          tailBytes.unshift(Number(base10Number % 256n));
          base10Number /= 256n;
        }
        const bytesToAdd = [...Array(leadingZeroes.length).fill(0), ...tailBytes];
        bytes.set(bytesToAdd, offset);
        return offset + bytesToAdd.length;
      }
    });
  };
  var getBaseXDecoder = (alphabet4) => {
    return createDecoder({
      read(rawBytes, offset) {
        const bytes = offset === 0 ? rawBytes : rawBytes.slice(offset);
        if(bytes.length === 0) return ["", 0];
        let trailIndex = bytes.findIndex((n) => n !== 0);
        trailIndex = trailIndex === -1 ? bytes.length : trailIndex;
        const leadingZeroes = alphabet4[0].repeat(trailIndex);
        if(trailIndex === bytes.length) return [leadingZeroes, rawBytes.length];
        const base10Number = bytes.slice(trailIndex).reduce((sum, byte) => sum * 256n + BigInt(byte), 0n);
        const tailChars = getBaseXFromBigInt(base10Number, alphabet4);
        return [leadingZeroes + tailChars, rawBytes.length];
      }
    });
  };
  var getBaseXCodec = (alphabet4) => combineCodec(getBaseXEncoder(alphabet4), getBaseXDecoder(alphabet4));

  function partitionLeadingZeroes(value, zeroCharacter) {
    const [leadingZeros, tailChars] = value.split(new RegExp(`((?!${zeroCharacter}).*)`));
    return [leadingZeros, tailChars];
  }

  function getBigIntFromBaseX(value, alphabet4) {
    const base = BigInt(alphabet4.length);
    let sum = 0n;
    for(const char of value) {
      sum *= base;
      sum += BigInt(alphabet4.indexOf(char));
    }
    return sum;
  }

  function getBaseXFromBigInt(value, alphabet4) {
    const base = BigInt(alphabet4.length);
    const tailChars = [];
    while(value > 0n) {
      tailChars.unshift(alphabet4[Number(value % base)]);
      value /= base;
    }
    return tailChars.join("");
  }

  var alphabet = "0123456789";
  var getBase10Encoder = () => getBaseXEncoder(alphabet);
  var getBase10Decoder = () => getBaseXDecoder(alphabet);
  var getBase10Codec = () => getBaseXCodec(alphabet);
  var INVALID_STRING_ERROR_BASE_CONFIG = {
    alphabet: "0123456789abcdef",
    base: 16
  };

  function charCodeToBase16(char) {
    if(char >= 48 && char <= 57) return char - 48;
    if(char >= 65 && char <= 70) return char - (65 - 10);
    if(char >= 97 && char <= 102) return char - (97 - 10);
  }

  var getBase16Encoder = () => createEncoder({
    getSizeFromValue: (value) => Math.ceil(value.length / 2),
    write(value, bytes, offset) {
      const len = value.length;
      const al = len / 2;
      if(len === 1) {
        const c = value.charCodeAt(0);
        const n = charCodeToBase16(c);
        if(n === void 0) {
          throw new SolanaError(SOLANA_ERROR__CODECS__INVALID_STRING_FOR_BASE, {
            ...INVALID_STRING_ERROR_BASE_CONFIG,
            value
          });
        }
        bytes.set([n], offset);
        return 1 + offset;
      }
      const hexBytes2 = new Uint8Array(al);
      for(let i = 0, j = 0; i < al; i++) {
        const c1 = value.charCodeAt(j++);
        const c2 = value.charCodeAt(j++);
        const n1 = charCodeToBase16(c1);
        const n2 = charCodeToBase16(c2);
        if(n1 === void 0 || n2 === void 0 && !Number.isNaN(c2)) {
          throw new SolanaError(SOLANA_ERROR__CODECS__INVALID_STRING_FOR_BASE, {
            ...INVALID_STRING_ERROR_BASE_CONFIG,
            value
          });
        }
        hexBytes2[i] = !Number.isNaN(c2) ? n1 << 4 | (n2 != null ? n2 : 0) : n1;
      }
      bytes.set(hexBytes2, offset);
      return hexBytes2.length + offset;
    }
  });
  var getBase16Decoder = () => createDecoder({
    read(bytes, offset) {
      const value = bytes.slice(offset).reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "");
      return [value, bytes.length];
    }
  });
  var getBase16Codec = () => combineCodec(getBase16Encoder(), getBase16Decoder());
  var alphabet2 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  var getBase58Encoder = () => getBaseXEncoder(alphabet2);
  var getBase58Decoder = () => getBaseXDecoder(alphabet2);
  var getBase58Codec = () => getBaseXCodec(alphabet2);
  var getBaseXResliceEncoder = (alphabet4, bits) => createEncoder({
    getSizeFromValue: (value) => Math.floor(value.length * bits / 8),
    write(value, bytes, offset) {
      assertValidBaseString(alphabet4, value);
      if(value === "") return offset;
      const charIndices = [...value].map((c) => alphabet4.indexOf(c));
      const reslicedBytes = reslice(charIndices, bits, 8, false);
      bytes.set(reslicedBytes, offset);
      return reslicedBytes.length + offset;
    }
  });
  var getBaseXResliceDecoder = (alphabet4, bits) => createDecoder({
    read(rawBytes, offset = 0) {
      const bytes = offset === 0 ? rawBytes : rawBytes.slice(offset);
      if(bytes.length === 0) return ["", rawBytes.length];
      const charIndices = reslice([...bytes], 8, bits, true);
      return [charIndices.map((i) => alphabet4[i]).join(""), rawBytes.length];
    }
  });
  var getBaseXResliceCodec = (alphabet4, bits) => combineCodec(getBaseXResliceEncoder(alphabet4, bits), getBaseXResliceDecoder(alphabet4, bits));

  function reslice(input, inputBits, outputBits, useRemainder) {
    const output = [];
    let accumulator = 0;
    let bitsInAccumulator = 0;
    const mask = (1 << outputBits) - 1;
    for(const value of input) {
      accumulator = accumulator << inputBits | value;
      bitsInAccumulator += inputBits;
      while(bitsInAccumulator >= outputBits) {
        bitsInAccumulator -= outputBits;
        output.push(accumulator >> bitsInAccumulator & mask);
      }
    }
    if(useRemainder && bitsInAccumulator > 0) {
      output.push(accumulator << outputBits - bitsInAccumulator & mask);
    }
    return output;
  }

  var alphabet3 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var getBase64Encoder = () => {
    {
      return createEncoder({
        getSizeFromValue: (value) => {
          try {
            return atob(value).length;
          } catch {
            throw new SolanaError(SOLANA_ERROR__CODECS__INVALID_STRING_FOR_BASE, {
              alphabet: alphabet3,
              base: 64,
              value
            });
          }
        },
        write(value, bytes, offset) {
          try {
            const bytesToAdd = atob(value).split("").map((c) => c.charCodeAt(0));
            bytes.set(bytesToAdd, offset);
            return bytesToAdd.length + offset;
          } catch {
            throw new SolanaError(SOLANA_ERROR__CODECS__INVALID_STRING_FOR_BASE, {
              alphabet: alphabet3,
              base: 64,
              value
            });
          }
        }
      });
    }
  };
  var getBase64Decoder = () => {
    {
      return createDecoder({
        read(bytes, offset = 0) {
          const slice = bytes.slice(offset);
          const value = btoa(String.fromCharCode(...slice));
          return [value, bytes.length];
        }
      });
    }
  };
  var getBase64Codec = () => combineCodec(getBase64Encoder(), getBase64Decoder());
  var removeNullCharacters = (value) => (
    // eslint-disable-next-line no-control-regex
    value.replace(/\u0000/g, "")
  );
  var padNullCharacters = (value, chars) => value.padEnd(chars, "\0");
  var e = globalThis.TextDecoder;
  var o = globalThis.TextEncoder;
  var getUtf8Encoder = () => {
    let textEncoder;
    return createEncoder({
      getSizeFromValue: (value) => (textEncoder || (textEncoder = new o())).encode(value).length,
      write: (value, bytes, offset) => {
        const bytesToAdd = (textEncoder || (textEncoder = new o())).encode(value);
        bytes.set(bytesToAdd, offset);
        return offset + bytesToAdd.length;
      }
    });
  };
  var getUtf8Decoder = () => {
    let textDecoder;
    return createDecoder({
      read(bytes, offset) {
        const value = (textDecoder || (textDecoder = new e())).decode(bytes.slice(offset));
        return [removeNullCharacters(value), bytes.length];
      }
    });
  };
  var getUtf8Codec = () => combineCodec(getUtf8Encoder(), getUtf8Decoder());

  // ../accounts/dist/index.browser.mjs
  var BASE_ACCOUNT_SIZE = 128;

  function decodeAccount(encodedAccount, decoder) {
    try {
      if("exists" in encodedAccount && !encodedAccount.exists) {
        return encodedAccount;
      }
      return Object.freeze({...encodedAccount, data: decoder.decode(encodedAccount.data)});
    } catch {
      throw new SolanaError(SOLANA_ERROR__ACCOUNTS__FAILED_TO_DECODE_ACCOUNT, {
        address: encodedAccount.address
      });
    }
  }

  function accountExists(account) {
    return !("exists" in account) || "exists" in account && account.exists;
  }

  function assertAccountDecoded(account) {
    if(accountExists(account) && account.data instanceof Uint8Array) {
      throw new SolanaError(SOLANA_ERROR__ACCOUNTS__EXPECTED_DECODED_ACCOUNT, {
        address: account.address
      });
    }
  }

  function assertAccountsDecoded(accounts) {
    const encoded = accounts.filter((a) => accountExists(a) && a.data instanceof Uint8Array);
    if(encoded.length > 0) {
      const encodedAddresses = encoded.map((a) => a.address);
      throw new SolanaError(SOLANA_ERROR__ACCOUNTS__EXPECTED_ALL_ACCOUNTS_TO_BE_DECODED, {
        addresses: encodedAddresses
      });
    }
  }

  function parseBase64RpcAccount(address2, rpcAccount) {
    if(!rpcAccount) return Object.freeze({address: address2, exists: false});
    const data = getBase64Encoder().encode(rpcAccount.data[0]);
    return Object.freeze({...parseBaseAccount(rpcAccount), address: address2, data, exists: true});
  }

  function parseBase58RpcAccount(address2, rpcAccount) {
    if(!rpcAccount) return Object.freeze({address: address2, exists: false});
    const data = getBase58Encoder().encode(typeof rpcAccount.data === "string" ? rpcAccount.data : rpcAccount.data[0]);
    return Object.freeze({...parseBaseAccount(rpcAccount), address: address2, data, exists: true});
  }

  function parseJsonRpcAccount(address2, rpcAccount) {
    if(!rpcAccount) return Object.freeze({address: address2, exists: false});
    const data = rpcAccount.data.parsed.info;
    return Object.freeze({...parseBaseAccount(rpcAccount), address: address2, data, exists: true});
  }

  function parseBaseAccount(rpcAccount) {
    return Object.freeze({
      executable: rpcAccount.executable,
      lamports: rpcAccount.lamports,
      programAddress: rpcAccount.owner
    });
  }

  function fetchEncodedAccount(rpc, address2, config = {}) {
    const {abortSignal, ...rpcConfig} = config;
    const response = rpc.getAccountInfo(address2, {...rpcConfig, encoding: "base64"}).send({abortSignal});
    return parseBase64RpcAccount(address2, response.value);
  }

  function fetchJsonParsedAccount(rpc, address2, config = {}) {
    const {abortSignal, ...rpcConfig} = config;
    const {value: account} = rpc.getAccountInfo(address2, {...rpcConfig, encoding: "jsonParsed"}).send({abortSignal});
    return !!account && typeof account === "object" && "parsed" in account.data ? parseJsonRpcAccount(address2, account) : parseBase64RpcAccount(address2, account);
  }

  function fetchEncodedAccounts(rpc, addresses, config = {}) {
    const {abortSignal, ...rpcConfig} = config;
    const response = rpc.getMultipleAccounts(addresses, {...rpcConfig, encoding: "base64"}).send({abortSignal});
    return response.value.map((account, index) => parseBase64RpcAccount(addresses[index], account));
  }

  function fetchJsonParsedAccounts(rpc, addresses, config = {}) {
    const {abortSignal, ...rpcConfig} = config;
    const response = rpc.getMultipleAccounts(addresses, {...rpcConfig, encoding: "jsonParsed"}).send({abortSignal});
    return response.value.map((account, index) => {
      return !!account && typeof account === "object" && "parsed" in account.data ? parseJsonRpcAccount(addresses[index], account) : parseBase64RpcAccount(addresses[index], account);
    });
  }

  function assertAccountExists(account) {
    if(!account.exists) {
      throw new SolanaError(SOLANA_ERROR__ACCOUNTS__ACCOUNT_NOT_FOUND, {address: account.address});
    }
  }

  function assertAccountsExist(accounts) {
    const missingAccounts = accounts.filter((a) => !a.exists);
    if(missingAccounts.length > 0) {
      const missingAddresses = missingAccounts.map((a) => a.address);
      throw new SolanaError(SOLANA_ERROR__ACCOUNTS__ONE_OR_MORE_ACCOUNTS_NOT_FOUND, {addresses: missingAddresses});
    }
  }

  // ../assertions/dist/index.browser.mjs
  function assertIsSecureContext() {
    // throw new SolanaError(SOLANA_ERROR__SUBTLE_CRYPTO__DISALLOWED_IN_INSECURE_CONTEXT);
  }

  var cachedEd25519Decision;

  function isEd25519CurveSupported(subtle) {
    if(cachedEd25519Decision === void 0) {
      cachedEd25519Decision = (() => {
        try {
          subtle.generateKey("Ed25519", /* extractable */ false, ["sign", "verify"]);
          return true;
        } catch(e) {
          return false;
        }
      })();
    }
    if(typeof cachedEd25519Decision === "boolean") {
      return cachedEd25519Decision;
    }
    else {
      return cachedEd25519Decision;
    }
  }

  function assertDigestCapabilityIsAvailable() {
    var _a;
    assertIsSecureContext();
    if(typeof globalThis.crypto === "undefined" || typeof ((_a = globalThis.crypto.subtle) == null ? void 0 : _a.digest) !== "function") {
      throw new SolanaError(SOLANA_ERROR__SUBTLE_CRYPTO__DIGEST_UNIMPLEMENTED);
    }
  }

  function assertKeyGenerationIsAvailable() {
    var _a;
    assertIsSecureContext();
    if(typeof globalThis.crypto === "undefined" || typeof ((_a = globalThis.crypto.subtle) == null ? void 0 : _a.generateKey) !== "function") {
      throw new SolanaError(SOLANA_ERROR__SUBTLE_CRYPTO__GENERATE_FUNCTION_UNIMPLEMENTED);
    }
    if(!isEd25519CurveSupported(globalThis.crypto.subtle)) {
      throw new SolanaError(SOLANA_ERROR__SUBTLE_CRYPTO__ED25519_ALGORITHM_UNIMPLEMENTED);
    }
  }

  function assertKeyExporterIsAvailable() {
    var _a;
    assertIsSecureContext();
    if(typeof globalThis.crypto === "undefined" || typeof ((_a = globalThis.crypto.subtle) == null ? void 0 : _a.exportKey) !== "function") {
      throw new SolanaError(SOLANA_ERROR__SUBTLE_CRYPTO__EXPORT_FUNCTION_UNIMPLEMENTED);
    }
  }

  function assertSigningCapabilityIsAvailable() {
    var _a;
    assertIsSecureContext();
    if(typeof globalThis.crypto === "undefined" || typeof ((_a = globalThis.crypto.subtle) == null ? void 0 : _a.sign) !== "function") {
      throw new SolanaError(SOLANA_ERROR__SUBTLE_CRYPTO__SIGN_FUNCTION_UNIMPLEMENTED);
    }
  }

  function assertVerificationCapabilityIsAvailable() {
    var _a;
    assertIsSecureContext();
    if(typeof globalThis.crypto === "undefined" || typeof ((_a = globalThis.crypto.subtle) == null ? void 0 : _a.verify) !== "function") {
      throw new SolanaError(SOLANA_ERROR__SUBTLE_CRYPTO__VERIFY_FUNCTION_UNIMPLEMENTED);
    }
  }

  function assertPRNGIsAvailable() {
    if(typeof globalThis.crypto === "undefined" || typeof globalThis.crypto.getRandomValues !== "function") {
      throw new SolanaError(SOLANA_ERROR__CRYPTO__RANDOM_VALUES_FUNCTION_UNIMPLEMENTED);
    }
  }

  // ../addresses/dist/index.browser.mjs
  var memoizedBase58Encoder;
  var memoizedBase58Decoder;

  function getMemoizedBase58Encoder() {
    if(!memoizedBase58Encoder) memoizedBase58Encoder = getBase58Encoder();
    return memoizedBase58Encoder;
  }

  function getMemoizedBase58Decoder() {
    if(!memoizedBase58Decoder) memoizedBase58Decoder = getBase58Decoder();
    return memoizedBase58Decoder;
  }

  function isAddress(putativeAddress) {
    if(
      // Lowest address (32 bytes of zeroes)
      putativeAddress.length < 32 || // Highest address (32 bytes of 255)
      putativeAddress.length > 44
    ) {
      return false;
    }
    const base58Encoder2 = getMemoizedBase58Encoder();
    try {
      return base58Encoder2.encode(putativeAddress).byteLength === 32;
    } catch {
      return false;
    }
  }

  function assertIsAddress(putativeAddress) {
    if(
      // Lowest address (32 bytes of zeroes)
      putativeAddress.length < 32 || // Highest address (32 bytes of 255)
      putativeAddress.length > 44
    ) {
      throw new SolanaError(SOLANA_ERROR__ADDRESSES__STRING_LENGTH_OUT_OF_RANGE, {
        actualLength: putativeAddress.length
      });
    }
    const base58Encoder2 = getMemoizedBase58Encoder();
    const bytes = base58Encoder2.encode(putativeAddress);
    const numBytes = bytes.byteLength;
    if(numBytes !== 32) {
      throw new SolanaError(SOLANA_ERROR__ADDRESSES__INVALID_BYTE_LENGTH, {
        actualLength: numBytes
      });
    }
  }

  function address(putativeAddress) {
    assertIsAddress(putativeAddress);
    return putativeAddress;
  }

  function getAddressEncoder() {
    return transformEncoder(
      fixEncoderSize(getMemoizedBase58Encoder(), 32),
      (putativeAddress) => address(putativeAddress)
    );
  }

  function getAddressDecoder() {
    return fixDecoderSize(getMemoizedBase58Decoder(), 32);
  }

  function getAddressCodec() {
    return combineCodec(getAddressEncoder(), getAddressDecoder());
  }

  function getAddressComparator() {
    return new Intl.Collator("en", {
      caseFirst: "lower",
      ignorePunctuation: false,
      localeMatcher: "best fit",
      numeric: false,
      sensitivity: "variant",
      usage: "sort"
    }).compare;
  }

  var D = 37095705934669439343138083508754565189542113879843219016388785533085940283555n;
  var P = 57896044618658097711785492504343953926634992332820282019728792003956564819949n;
  var RM1 = 19681161376707505956807079304988542015446066515923890162744021073123829784752n;

  function mod(a) {
    const r = a % P;
    return r >= 0n ? r : P + r;
  }

  function pow2(x, power) {
    let r = x;
    while(power-- > 0n) {
      r *= r;
      r %= P;
    }
    return r;
  }

  function pow_2_252_3(x) {
    const x2 = x * x % P;
    const b2 = x2 * x % P;
    const b4 = pow2(b2, 2n) * b2 % P;
    const b5 = pow2(b4, 1n) * x % P;
    const b10 = pow2(b5, 5n) * b5 % P;
    const b20 = pow2(b10, 10n) * b10 % P;
    const b40 = pow2(b20, 20n) * b20 % P;
    const b80 = pow2(b40, 40n) * b40 % P;
    const b160 = pow2(b80, 80n) * b80 % P;
    const b240 = pow2(b160, 80n) * b80 % P;
    const b250 = pow2(b240, 10n) * b10 % P;
    const pow_p_5_8 = pow2(b250, 2n) * x % P;
    return pow_p_5_8;
  }

  function uvRatio(u, v) {
    const v3 = mod(v * v * v);
    const v7 = mod(v3 * v3 * v);
    const pow = pow_2_252_3(u * v7);
    let x = mod(u * v3 * pow);
    const vx2 = mod(v * x * x);
    const root1 = x;
    const root2 = mod(x * RM1);
    const useRoot1 = vx2 === u;
    const useRoot2 = vx2 === mod(-u);
    const noRoot = vx2 === mod(-u * RM1);
    if(useRoot1) x = root1;
    if(useRoot2 || noRoot) x = root2;
    if((mod(x) & 1n) === 1n) x = mod(-x);
    if(!useRoot1 && !useRoot2) {
      return null;
    }
    return x;
  }

  function pointIsOnCurve(y, lastByte) {
    const y2 = mod(y * y);
    const u = mod(y2 - 1n);
    const v = mod(D * y2 + 1n);
    const x = uvRatio(u, v);
    if(x === null) {
      return false;
    }
    const isLastByteOdd = (lastByte & 128) !== 0;
    if(x === 0n && isLastByteOdd) {
      return false;
    }
    return true;
  }

  function byteToHex(byte) {
    const hexString = byte.toString(16);
    if(hexString.length === 1) {
      return `0${hexString}`;
    }
    else {
      return hexString;
    }
  }

  function decompressPointBytes(bytes) {
    const hexString = bytes.reduce((acc, byte, ii) => `${byteToHex(ii === 31 ? byte & ~128 : byte)}${acc}`, "");
    const integerLiteralString = `0x${hexString}`;
    return BigInt(integerLiteralString);
  }

  function compressedPointBytesAreOnCurve(bytes) {
    if(bytes.byteLength !== 32) {
      return false;
    }
    const y = decompressPointBytes(bytes);
    return pointIsOnCurve(y, bytes[31]);
  }

  function isProgramDerivedAddress(value) {
    return Array.isArray(value) && value.length === 2 && typeof value[0] === "string" && typeof value[1] === "number" && value[1] >= 0 && value[1] <= 255 && isAddress(value[0]);
  }

  function assertIsProgramDerivedAddress(value) {
    const validFormat = Array.isArray(value) && value.length === 2 && typeof value[0] === "string" && typeof value[1] === "number";
    if(!validFormat) {
      throw new SolanaError(SOLANA_ERROR__ADDRESSES__MALFORMED_PDA);
    }
    if(value[1] < 0 || value[1] > 255) {
      throw new SolanaError(SOLANA_ERROR__ADDRESSES__PDA_BUMP_SEED_OUT_OF_RANGE, {
        bump: value[1]
      });
    }
    assertIsAddress(value[0]);
  }

  var MAX_SEED_LENGTH = 32;
  var MAX_SEEDS = 16;
  var PDA_MARKER_BYTES = [
    // The string 'ProgramDerivedAddress'
    80,
    114,
    111,
    103,
    114,
    97,
    109,
    68,
    101,
    114,
    105,
    118,
    101,
    100,
    65,
    100,
    100,
    114,
    101,
    115,
    115
  ];

  function createProgramDerivedAddress({programAddress, seeds}) {
    assertDigestCapabilityIsAvailable();
    if(seeds.length > MAX_SEEDS) {
      throw new SolanaError(SOLANA_ERROR__ADDRESSES__MAX_NUMBER_OF_PDA_SEEDS_EXCEEDED, {
        actual: seeds.length,
        maxSeeds: MAX_SEEDS
      });
    }
    let textEncoder;
    const seedBytes = seeds.reduce((acc, seed, ii) => {
      const bytes = typeof seed === "string" ? (textEncoder || (textEncoder = new TextEncoder())).encode(seed) : seed;
      if(bytes.byteLength > MAX_SEED_LENGTH) {
        throw new SolanaError(SOLANA_ERROR__ADDRESSES__MAX_PDA_SEED_LENGTH_EXCEEDED, {
          actual: bytes.byteLength,
          index: ii,
          maxSeedLength: MAX_SEED_LENGTH
        });
      }
      acc.push(...bytes);
      return acc;
    }, []);
    const base58EncodedAddressCodec = getAddressCodec();
    const programAddressBytes = base58EncodedAddressCodec.encode(programAddress);
    const addressBytesBuffer = crypto.subtle.digest(
      "SHA-256",
      new Uint8Array([...seedBytes, ...programAddressBytes, ...PDA_MARKER_BYTES])
    );
    const addressBytes = new Uint8Array(addressBytesBuffer);
    if(compressedPointBytesAreOnCurve(addressBytes)) {
      throw new SolanaError(SOLANA_ERROR__ADDRESSES__INVALID_SEEDS_POINT_ON_CURVE);
    }
    return base58EncodedAddressCodec.decode(addressBytes);
  }

  function getProgramDerivedAddress({
    programAddress,
    seeds
  }) {
    let bumpSeed = 255;
    while(bumpSeed > 0) {
      try {
        const address2 = createProgramDerivedAddress({
          programAddress,
          seeds: [...seeds, new Uint8Array([bumpSeed])]
        });
        return [address2, bumpSeed];
      } catch(e3) {
        if(isSolanaError(e3, SOLANA_ERROR__ADDRESSES__INVALID_SEEDS_POINT_ON_CURVE)) {
          bumpSeed--;
        }
        else {
          throw e3;
        }
      }
    }
    throw new SolanaError(SOLANA_ERROR__ADDRESSES__FAILED_TO_FIND_VIABLE_PDA_BUMP_SEED);
  }

  function createAddressWithSeed({baseAddress, programAddress, seed}) {
    const {encode, decode} = getAddressCodec();
    const seedBytes = typeof seed === "string" ? new TextEncoder().encode(seed) : seed;
    if(seedBytes.byteLength > MAX_SEED_LENGTH) {
      throw new SolanaError(SOLANA_ERROR__ADDRESSES__MAX_PDA_SEED_LENGTH_EXCEEDED, {
        actual: seedBytes.byteLength,
        index: 0,
        maxSeedLength: MAX_SEED_LENGTH
      });
    }
    const programAddressBytes = encode(programAddress);
    if(programAddressBytes.length >= PDA_MARKER_BYTES.length && programAddressBytes.slice(-PDA_MARKER_BYTES.length).every((byte, index) => byte === PDA_MARKER_BYTES[index])) {
      throw new SolanaError(SOLANA_ERROR__ADDRESSES__PDA_ENDS_WITH_PDA_MARKER);
    }
    const addressBytesBuffer = crypto.subtle.digest(
      "SHA-256",
      new Uint8Array([...encode(baseAddress), ...seedBytes, ...programAddressBytes])
    );
    const addressBytes = new Uint8Array(addressBytesBuffer);
    return decode(addressBytes);
  }

  function getAddressFromPublicKey(publicKey) {
    assertKeyExporterIsAvailable();
    if(publicKey.type !== "public" || publicKey.algorithm.name !== "Ed25519") {
      throw new SolanaError(SOLANA_ERROR__ADDRESSES__INVALID_ED25519_PUBLIC_KEY);
    }
    const publicKeyBytes = crypto.subtle.exportKey("raw", publicKey);
    return getAddressDecoder().decode(new Uint8Array(publicKeyBytes));
  }

  // ../codecs-numbers/dist/index.browser.mjs
  function assertNumberIsBetweenForCodec(codecDescription, min, max, value) {
    if(value < min || value > max) {
      throw new SolanaError(SOLANA_ERROR__CODECS__NUMBER_OUT_OF_RANGE, {
        codecDescription,
        max,
        min,
        value
      });
    }
  }

  var Endian = /* @__PURE__ */ ((Endian2) => {
    Endian2[Endian2["Little"] = 0] = "Little";
    Endian2[Endian2["Big"] = 1] = "Big";
    return Endian2;
  })(Endian || {});

  function isLittleEndian(config) {
    return (config == null ? void 0 : config.endian) === 1 ? false : true;
  }

  function numberEncoderFactory(input) {
    return createEncoder({
      fixedSize: input.size,
      write(value, bytes, offset) {
        if(input.range) {
          assertNumberIsBetweenForCodec(input.name, input.range[0], input.range[1], value);
        }
        const arrayBuffer = new ArrayBuffer(input.size);
        input.set(new DataView(arrayBuffer), value, isLittleEndian(input.config));
        bytes.set(new Uint8Array(arrayBuffer), offset);
        return offset + input.size;
      }
    });
  }

  function numberDecoderFactory(input) {
    return createDecoder({
      fixedSize: input.size,
      read(bytes, offset = 0) {
        assertByteArrayIsNotEmptyForCodec(input.name, bytes, offset);
        assertByteArrayHasEnoughBytesForCodec(input.name, input.size, bytes, offset);
        const view = new DataView(toArrayBuffer(bytes, offset, input.size));
        return [input.get(view, isLittleEndian(input.config)), offset + input.size];
      }
    });
  }

  function toArrayBuffer(bytes, offset, length) {
    const bytesOffset = bytes.byteOffset + (offset != null ? offset : 0);
    const bytesLength = length != null ? length : bytes.byteLength;
    return bytes.buffer.slice(bytesOffset, bytesOffset + bytesLength);
  }

  var getF32Encoder = (config = {}) => numberEncoderFactory({
    config,
    name: "f32",
    set: (view, value, le) => view.setFloat32(0, Number(value), le),
    size: 4
  });
  var getF32Decoder = (config = {}) => numberDecoderFactory({
    config,
    get: (view, le) => view.getFloat32(0, le),
    name: "f32",
    size: 4
  });
  var getF32Codec = (config = {}) => combineCodec(getF32Encoder(config), getF32Decoder(config));
  var getF64Encoder = (config = {}) => numberEncoderFactory({
    config,
    name: "f64",
    set: (view, value, le) => view.setFloat64(0, Number(value), le),
    size: 8
  });
  var getF64Decoder = (config = {}) => numberDecoderFactory({
    config,
    get: (view, le) => view.getFloat64(0, le),
    name: "f64",
    size: 8
  });
  var getF64Codec = (config = {}) => combineCodec(getF64Encoder(config), getF64Decoder(config));
  var getI128Encoder = (config = {}) => numberEncoderFactory({
    config,
    name: "i128",
    range: [-BigInt("0x7fffffffffffffffffffffffffffffff") - 1n, BigInt("0x7fffffffffffffffffffffffffffffff")],
    set: (view, value, le) => {
      const leftOffset = le ? 8 : 0;
      const rightOffset = le ? 0 : 8;
      const rightMask = 0xffffffffffffffffn;
      view.setBigInt64(leftOffset, BigInt(value) >> 64n, le);
      view.setBigUint64(rightOffset, BigInt(value) & rightMask, le);
    },
    size: 16
  });
  var getI128Decoder = (config = {}) => numberDecoderFactory({
    config,
    get: (view, le) => {
      const leftOffset = le ? 8 : 0;
      const rightOffset = le ? 0 : 8;
      const left = view.getBigInt64(leftOffset, le);
      const right = view.getBigUint64(rightOffset, le);
      return (left << 64n) + right;
    },
    name: "i128",
    size: 16
  });
  var getI128Codec = (config = {}) => combineCodec(getI128Encoder(config), getI128Decoder(config));
  var getI16Encoder = (config = {}) => numberEncoderFactory({
    config,
    name: "i16",
    range: [-Number("0x7fff") - 1, Number("0x7fff")],
    set: (view, value, le) => view.setInt16(0, Number(value), le),
    size: 2
  });
  var getI16Decoder = (config = {}) => numberDecoderFactory({
    config,
    get: (view, le) => view.getInt16(0, le),
    name: "i16",
    size: 2
  });
  var getI16Codec = (config = {}) => combineCodec(getI16Encoder(config), getI16Decoder(config));
  var getI32Encoder = (config = {}) => numberEncoderFactory({
    config,
    name: "i32",
    range: [-Number("0x7fffffff") - 1, Number("0x7fffffff")],
    set: (view, value, le) => view.setInt32(0, Number(value), le),
    size: 4
  });
  var getI32Decoder = (config = {}) => numberDecoderFactory({
    config,
    get: (view, le) => view.getInt32(0, le),
    name: "i32",
    size: 4
  });
  var getI32Codec = (config = {}) => combineCodec(getI32Encoder(config), getI32Decoder(config));
  var getI64Encoder = (config = {}) => numberEncoderFactory({
    config,
    name: "i64",
    range: [-BigInt("0x7fffffffffffffff") - 1n, BigInt("0x7fffffffffffffff")],
    set: (view, value, le) => view.setBigInt64(0, BigInt(value), le),
    size: 8
  });
  var getI64Decoder = (config = {}) => numberDecoderFactory({
    config,
    get: (view, le) => view.getBigInt64(0, le),
    name: "i64",
    size: 8
  });
  var getI64Codec = (config = {}) => combineCodec(getI64Encoder(config), getI64Decoder(config));
  var getI8Encoder = () => numberEncoderFactory({
    name: "i8",
    range: [-Number("0x7f") - 1, Number("0x7f")],
    set: (view, value) => view.setInt8(0, Number(value)),
    size: 1
  });
  var getI8Decoder = () => numberDecoderFactory({
    get: (view) => view.getInt8(0),
    name: "i8",
    size: 1
  });
  var getI8Codec = () => combineCodec(getI8Encoder(), getI8Decoder());
  var getShortU16Encoder = () => createEncoder({
    getSizeFromValue: (value) => {
      if(value <= 127) return 1;
      if(value <= 16383) return 2;
      return 3;
    },
    maxSize: 3,
    write: (value, bytes, offset) => {
      assertNumberIsBetweenForCodec("shortU16", 0, 65535, value);
      const shortU16Bytes = [0];
      for(let ii = 0; ; ii += 1) {
        const alignedValue = Number(value) >> ii * 7;
        if(alignedValue === 0) {
          break;
        }
        const nextSevenBits = 127 & alignedValue;
        shortU16Bytes[ii] = nextSevenBits;
        if(ii > 0) {
          shortU16Bytes[ii - 1] |= 128;
        }
      }
      bytes.set(shortU16Bytes, offset);
      return offset + shortU16Bytes.length;
    }
  });
  var getShortU16Decoder = () => createDecoder({
    maxSize: 3,
    read: (bytes, offset) => {
      let value = 0;
      let byteCount = 0;
      while(++byteCount) {
        const byteIndex = byteCount - 1;
        const currentByte = bytes[offset + byteIndex];
        const nextSevenBits = 127 & currentByte;
        value |= nextSevenBits << byteIndex * 7;
        if((currentByte & 128) === 0) {
          break;
        }
      }
      return [value, offset + byteCount];
    }
  });
  var getShortU16Codec = () => combineCodec(getShortU16Encoder(), getShortU16Decoder());
  var getU128Encoder = (config = {}) => numberEncoderFactory({
    config,
    name: "u128",
    range: [0n, BigInt("0xffffffffffffffffffffffffffffffff")],
    set: (view, value, le) => {
      const leftOffset = le ? 8 : 0;
      const rightOffset = le ? 0 : 8;
      const rightMask = 0xffffffffffffffffn;
      view.setBigUint64(leftOffset, BigInt(value) >> 64n, le);
      view.setBigUint64(rightOffset, BigInt(value) & rightMask, le);
    },
    size: 16
  });
  var getU128Decoder = (config = {}) => numberDecoderFactory({
    config,
    get: (view, le) => {
      const leftOffset = le ? 8 : 0;
      const rightOffset = le ? 0 : 8;
      const left = view.getBigUint64(leftOffset, le);
      const right = view.getBigUint64(rightOffset, le);
      return (left << 64n) + right;
    },
    name: "u128",
    size: 16
  });
  var getU128Codec = (config = {}) => combineCodec(getU128Encoder(config), getU128Decoder(config));
  var getU16Encoder = (config = {}) => numberEncoderFactory({
    config,
    name: "u16",
    range: [0, Number("0xffff")],
    set: (view, value, le) => view.setUint16(0, Number(value), le),
    size: 2
  });
  var getU16Decoder = (config = {}) => numberDecoderFactory({
    config,
    get: (view, le) => view.getUint16(0, le),
    name: "u16",
    size: 2
  });
  var getU16Codec = (config = {}) => combineCodec(getU16Encoder(config), getU16Decoder(config));
  var getU32Encoder = (config = {}) => numberEncoderFactory({
    config,
    name: "u32",
    range: [0, Number("0xffffffff")],
    set: (view, value, le) => view.setUint32(0, Number(value), le),
    size: 4
  });
  var getU32Decoder = (config = {}) => numberDecoderFactory({
    config,
    get: (view, le) => view.getUint32(0, le),
    name: "u32",
    size: 4
  });
  var getU32Codec = (config = {}) => combineCodec(getU32Encoder(config), getU32Decoder(config));
  var getU64Encoder = (config = {}) => numberEncoderFactory({
    config,
    name: "u64",
    range: [0n, BigInt("0xffffffffffffffff")],
    set: (view, value, le) => view.setBigUint64(0, BigInt(value), le),
    size: 8
  });
  var getU64Decoder = (config = {}) => numberDecoderFactory({
    config,
    get: (view, le) => view.getBigUint64(0, le),
    name: "u64",
    size: 8
  });
  var getU64Codec = (config = {}) => combineCodec(getU64Encoder(config), getU64Decoder(config));
  var getU8Encoder = () => numberEncoderFactory({
    name: "u8",
    range: [0, Number("0xff")],
    set: (view, value) => view.setUint8(0, Number(value)),
    size: 1
  });
  var getU8Decoder = () => numberDecoderFactory({
    get: (view) => view.getUint8(0),
    name: "u8",
    size: 1
  });
  var getU8Codec = () => combineCodec(getU8Encoder(), getU8Decoder());

  // ../codecs-data-structures/dist/index.browser.mjs
  function assertValidNumberOfItemsForCodec(codecDescription, expected, actual) {
    if(expected !== actual) {
      throw new SolanaError(SOLANA_ERROR__CODECS__INVALID_NUMBER_OF_ITEMS, {
        actual,
        codecDescription,
        expected
      });
    }
  }

  function maxCodecSizes(sizes) {
    return sizes.reduce(
      (all, size) => all === null || size === null ? null : Math.max(all, size),
      0
    );
  }

  function sumCodecSizes(sizes) {
    return sizes.reduce((all, size) => all === null || size === null ? null : all + size, 0);
  }

  function getFixedSize(codec) {
    return isFixedSize(codec) ? codec.fixedSize : null;
  }

  function getMaxSize(codec) {
    var _a;
    return isFixedSize(codec) ? codec.fixedSize : (_a = codec.maxSize) != null ? _a : null;
  }

  function getArrayEncoder(item, config = {}) {
    var _a, _b;
    const size = (_a = config.size) != null ? _a : getU32Encoder();
    const fixedSize = computeArrayLikeCodecSize(size, getFixedSize(item));
    const maxSize = (_b = computeArrayLikeCodecSize(size, getMaxSize(item))) != null ? _b : void 0;
    return createEncoder({
      ...fixedSize !== null ? {fixedSize} : {
        getSizeFromValue: (array) => {
          const prefixSize = typeof size === "object" ? getEncodedSize(array.length, size) : 0;
          return prefixSize + [...array].reduce((all, value) => all + getEncodedSize(value, item), 0);
        },
        maxSize
      },
      write: (array, bytes, offset) => {
        if(typeof size === "number") {
          assertValidNumberOfItemsForCodec("array", size, array.length);
        }
        if(typeof size === "object") {
          offset = size.write(array.length, bytes, offset);
        }
        array.forEach((value) => {
          offset = item.write(value, bytes, offset);
        });
        return offset;
      }
    });
  }

  function getArrayDecoder(item, config = {}) {
    var _a, _b;
    const size = (_a = config.size) != null ? _a : getU32Decoder();
    const itemSize = getFixedSize(item);
    const fixedSize = computeArrayLikeCodecSize(size, itemSize);
    const maxSize = (_b = computeArrayLikeCodecSize(size, getMaxSize(item))) != null ? _b : void 0;
    return createDecoder({
      ...fixedSize !== null ? {fixedSize} : {maxSize},
      read: (bytes, offset) => {
        const array = [];
        if(typeof size === "object" && bytes.slice(offset).length === 0) {
          return [array, offset];
        }
        if(size === "remainder") {
          while(offset < bytes.length) {
            const [value, newOffset2] = item.read(bytes, offset);
            offset = newOffset2;
            array.push(value);
          }
          return [array, offset];
        }
        const [resolvedSize, newOffset] = typeof size === "number" ? [size, offset] : size.read(bytes, offset);
        offset = newOffset;
        for(let i = 0; i < resolvedSize; i += 1) {
          const [value, newOffset2] = item.read(bytes, offset);
          offset = newOffset2;
          array.push(value);
        }
        return [array, offset];
      }
    });
  }

  function getArrayCodec(item, config = {}) {
    return combineCodec(getArrayEncoder(item, config), getArrayDecoder(item, config));
  }

  function computeArrayLikeCodecSize(size, itemSize) {
    if(typeof size !== "number") return null;
    if(size === 0) return 0;
    return itemSize === null ? null : itemSize * size;
  }

  function getBitArrayEncoder(size, config = {}) {
    var _a;
    const parsedConfig = typeof config === "boolean" ? {backward: config} : config;
    const backward = (_a = parsedConfig.backward) != null ? _a : false;
    return createEncoder({
      fixedSize: size,
      write(value, bytes, offset) {
        var _a2;
        const bytesToAdd = [];
        for(let i = 0; i < size; i += 1) {
          let byte = 0;
          for(let j = 0; j < 8; j += 1) {
            const feature = Number((_a2 = value[i * 8 + j]) != null ? _a2 : 0);
            byte |= feature << (backward ? j : 7 - j);
          }
          if(backward) {
            bytesToAdd.unshift(byte);
          }
          else {
            bytesToAdd.push(byte);
          }
        }
        bytes.set(bytesToAdd, offset);
        return size;
      }
    });
  }

  function getBitArrayDecoder(size, config = {}) {
    var _a;
    const parsedConfig = typeof config === "boolean" ? {backward: config} : config;
    const backward = (_a = parsedConfig.backward) != null ? _a : false;
    return createDecoder({
      fixedSize: size,
      read(bytes, offset) {
        assertByteArrayHasEnoughBytesForCodec("bitArray", size, bytes, offset);
        const booleans = [];
        let slice = bytes.slice(offset, offset + size);
        slice = backward ? slice.reverse() : slice;
        slice.forEach((byte) => {
          for(let i = 0; i < 8; i += 1) {
            if(backward) {
              booleans.push(Boolean(byte & 1));
              byte >>= 1;
            }
            else {
              booleans.push(Boolean(byte & 128));
              byte <<= 1;
            }
          }
        });
        return [booleans, offset + size];
      }
    });
  }

  function getBitArrayCodec(size, config = {}) {
    return combineCodec(getBitArrayEncoder(size, config), getBitArrayDecoder(size, config));
  }

  function getBooleanEncoder(config = {}) {
    var _a;
    return transformEncoder((_a = config.size) != null ? _a : getU8Encoder(), (value) => value ? 1 : 0);
  }

  function getBooleanDecoder(config = {}) {
    var _a;
    return transformDecoder((_a = config.size) != null ? _a : getU8Decoder(), (value) => Number(value) === 1);
  }

  function getBooleanCodec(config = {}) {
    return combineCodec(getBooleanEncoder(config), getBooleanDecoder(config));
  }

  function getBytesEncoder() {
    return createEncoder({
      getSizeFromValue: (value) => value.length,
      write: (value, bytes, offset) => {
        bytes.set(value, offset);
        return offset + value.length;
      }
    });
  }

  function getBytesDecoder() {
    return createDecoder({
      read: (bytes, offset) => {
        const slice = bytes.slice(offset);
        return [slice, offset + slice.length];
      }
    });
  }

  function getBytesCodec() {
    return combineCodec(getBytesEncoder(), getBytesDecoder());
  }

  var getBase16Decoder2 = () => createDecoder({
    read(bytes, offset) {
      const value = bytes.slice(offset).reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "");
      return [value, bytes.length];
    }
  });

  function getConstantEncoder(constant) {
    return createEncoder({
      fixedSize: constant.length,
      write: (_, bytes, offset) => {
        bytes.set(constant, offset);
        return offset + constant.length;
      }
    });
  }

  function getConstantDecoder(constant) {
    return createDecoder({
      fixedSize: constant.length,
      read: (bytes, offset) => {
        const base16 = getBase16Decoder2();
        if(!containsBytes(bytes, constant, offset)) {
          throw new SolanaError(SOLANA_ERROR__CODECS__INVALID_CONSTANT, {
            constant,
            data: bytes,
            hexConstant: base16.decode(constant),
            hexData: base16.decode(bytes),
            offset
          });
        }
        return [void 0, offset + constant.length];
      }
    });
  }

  function getConstantCodec(constant) {
    return combineCodec(getConstantEncoder(constant), getConstantDecoder(constant));
  }

  function getTupleEncoder(items) {
    var _a;
    const fixedSize = sumCodecSizes(items.map(getFixedSize));
    const maxSize = (_a = sumCodecSizes(items.map(getMaxSize))) != null ? _a : void 0;
    return createEncoder({
      ...fixedSize === null ? {
        getSizeFromValue: (value) => items.map((item, index) => getEncodedSize(value[index], item)).reduce((all, one) => all + one, 0),
        maxSize
      } : {fixedSize},
      write: (value, bytes, offset) => {
        assertValidNumberOfItemsForCodec("tuple", items.length, value.length);
        items.forEach((item, index) => {
          offset = item.write(value[index], bytes, offset);
        });
        return offset;
      }
    });
  }

  function getTupleDecoder(items) {
    var _a;
    const fixedSize = sumCodecSizes(items.map(getFixedSize));
    const maxSize = (_a = sumCodecSizes(items.map(getMaxSize))) != null ? _a : void 0;
    return createDecoder({
      ...fixedSize === null ? {maxSize} : {fixedSize},
      read: (bytes, offset) => {
        const values = [];
        items.forEach((item) => {
          const [newValue, newOffset] = item.read(bytes, offset);
          values.push(newValue);
          offset = newOffset;
        });
        return [values, offset];
      }
    });
  }

  function getTupleCodec(items) {
    return combineCodec(
      getTupleEncoder(items),
      getTupleDecoder(items)
    );
  }

  function getUnionEncoder(variants, getIndexFromValue) {
    const fixedSize = getUnionFixedSize(variants);
    const write = (variant, bytes, offset) => {
      const index = getIndexFromValue(variant);
      assertValidVariantIndex(variants, index);
      return variants[index].write(variant, bytes, offset);
    };
    if(fixedSize !== null) {
      return createEncoder({fixedSize, write});
    }
    const maxSize = getUnionMaxSize(variants);
    return createEncoder({
      ...maxSize !== null ? {maxSize} : {},
      getSizeFromValue: (variant) => {
        const index = getIndexFromValue(variant);
        assertValidVariantIndex(variants, index);
        return getEncodedSize(variant, variants[index]);
      },
      write
    });
  }

  function getUnionDecoder(variants, getIndexFromBytes) {
    const fixedSize = getUnionFixedSize(variants);
    const read = (bytes, offset) => {
      const index = getIndexFromBytes(bytes, offset);
      assertValidVariantIndex(variants, index);
      return variants[index].read(bytes, offset);
    };
    if(fixedSize !== null) {
      return createDecoder({fixedSize, read});
    }
    const maxSize = getUnionMaxSize(variants);
    return createDecoder({...maxSize !== null ? {maxSize} : {}, read});
  }

  function getUnionCodec(variants, getIndexFromValue, getIndexFromBytes) {
    return combineCodec(
      getUnionEncoder(variants, getIndexFromValue),
      getUnionDecoder(variants, getIndexFromBytes)
    );
  }

  function assertValidVariantIndex(variants, index) {
    if(typeof variants[index] === "undefined") {
      throw new SolanaError(SOLANA_ERROR__CODECS__UNION_VARIANT_OUT_OF_RANGE, {
        maxRange: variants.length - 1,
        minRange: 0,
        variant: index
      });
    }
  }

  function getUnionFixedSize(variants) {
    if(variants.length === 0) return 0;
    if(!isFixedSize(variants[0])) return null;
    const variantSize = variants[0].fixedSize;
    const sameSizedVariants = variants.every((variant) => isFixedSize(variant) && variant.fixedSize === variantSize);
    return sameSizedVariants ? variantSize : null;
  }

  function getUnionMaxSize(variants) {
    return maxCodecSizes(variants.map((variant) => getMaxSize(variant)));
  }

  function getDiscriminatedUnionEncoder(variants, config = {}) {
    var _a, _b;
    const discriminatorProperty = (_a = config.discriminator) != null ? _a : "__kind";
    const prefix = (_b = config.size) != null ? _b : getU8Encoder();
    return getUnionEncoder(
      variants.map(
        ([, variant], index) => transformEncoder(getTupleEncoder([prefix, variant]), (value) => [index, value])
      ),
      (value) => getVariantDiscriminator(variants, value[discriminatorProperty])
    );
  }

  function getDiscriminatedUnionDecoder(variants, config = {}) {
    var _a, _b;
    const discriminatorProperty = (_a = config.discriminator) != null ? _a : "__kind";
    const prefix = (_b = config.size) != null ? _b : getU8Decoder();
    return getUnionDecoder(
      variants.map(
        ([discriminator, variant]) => transformDecoder(getTupleDecoder([prefix, variant]), ([, value]) => ({
          [discriminatorProperty]: discriminator,
          ...value
        }))
      ),
      (bytes, offset) => Number(prefix.read(bytes, offset)[0])
    );
  }

  function getDiscriminatedUnionCodec(variants, config = {}) {
    return combineCodec(
      getDiscriminatedUnionEncoder(variants, config),
      getDiscriminatedUnionDecoder(variants, config)
    );
  }

  function getVariantDiscriminator(variants, discriminatorValue) {
    const discriminator = variants.findIndex(([key]) => discriminatorValue === key);
    if(discriminator < 0) {
      throw new SolanaError(SOLANA_ERROR__CODECS__INVALID_DISCRIMINATED_UNION_VARIANT, {
        value: discriminatorValue,
        variants: variants.map(([key]) => key)
      });
    }
    return discriminator;
  }

  var getDataEnumEncoder = getDiscriminatedUnionEncoder;
  var getDataEnumDecoder = getDiscriminatedUnionDecoder;
  var getDataEnumCodec = getDiscriminatedUnionCodec;

  function getEnumStats(constructor) {
    const numericalValues = [...new Set(Object.values(constructor).filter((v) => typeof v === "number"))].sort();
    const enumRecord = Object.fromEntries(Object.entries(constructor).slice(numericalValues.length));
    const enumKeys = Object.keys(enumRecord);
    const enumValues = Object.values(enumRecord);
    const stringValues = [
      .../* @__PURE__ */ new Set([...enumKeys, ...enumValues.filter((v) => typeof v === "string")])
    ];
    return {enumKeys, enumRecord, enumValues, numericalValues, stringValues};
  }

  function getEnumIndexFromVariant({
    enumKeys,
    enumValues,
    variant
  }) {
    const valueIndex = findLastIndex(enumValues, (value) => value === variant);
    if(valueIndex >= 0) return valueIndex;
    return enumKeys.findIndex((key) => key === variant);
  }

  function getEnumIndexFromDiscriminator({
    discriminator,
    enumKeys,
    enumValues,
    useValuesAsDiscriminators
  }) {
    if(!useValuesAsDiscriminators) {
      return discriminator >= 0 && discriminator < enumKeys.length ? discriminator : -1;
    }
    return findLastIndex(enumValues, (value) => value === discriminator);
  }

  function findLastIndex(array, predicate) {
    let l = array.length;
    while(l--) {
      if(predicate(array[l], l, array)) return l;
    }
    return -1;
  }

  function formatNumericalValues(values) {
    if(values.length === 0) return "";
    let range = [values[0], values[0]];
    const ranges = [];
    for(let index = 1; index < values.length; index++) {
      const value = values[index];
      if(range[1] + 1 === value) {
        range[1] = value;
      }
      else {
        ranges.push(range[0] === range[1] ? `${range[0]}` : `${range[0]}-${range[1]}`);
        range = [value, value];
      }
    }
    ranges.push(range[0] === range[1] ? `${range[0]}` : `${range[0]}-${range[1]}`);
    return ranges.join(", ");
  }

  function getEnumEncoder(constructor, config = {}) {
    var _a, _b;
    const prefix = (_a = config.size) != null ? _a : getU8Encoder();
    const useValuesAsDiscriminators = (_b = config.useValuesAsDiscriminators) != null ? _b : false;
    const {enumKeys, enumValues, numericalValues, stringValues} = getEnumStats(constructor);
    if(useValuesAsDiscriminators && enumValues.some((value) => typeof value === "string")) {
      throw new SolanaError(SOLANA_ERROR__CODECS__CANNOT_USE_LEXICAL_VALUES_AS_ENUM_DISCRIMINATORS, {
        stringValues: enumValues.filter((v) => typeof v === "string")
      });
    }
    return transformEncoder(prefix, (variant) => {
      const index = getEnumIndexFromVariant({enumKeys, enumValues, variant});
      if(index < 0) {
        throw new SolanaError(SOLANA_ERROR__CODECS__INVALID_ENUM_VARIANT, {
          formattedNumericalValues: formatNumericalValues(numericalValues),
          numericalValues,
          stringValues,
          variant
        });
      }
      return useValuesAsDiscriminators ? enumValues[index] : index;
    });
  }

  function getEnumDecoder(constructor, config = {}) {
    var _a, _b;
    const prefix = (_a = config.size) != null ? _a : getU8Decoder();
    const useValuesAsDiscriminators = (_b = config.useValuesAsDiscriminators) != null ? _b : false;
    const {enumKeys, enumValues, numericalValues} = getEnumStats(constructor);
    if(useValuesAsDiscriminators && enumValues.some((value) => typeof value === "string")) {
      throw new SolanaError(SOLANA_ERROR__CODECS__CANNOT_USE_LEXICAL_VALUES_AS_ENUM_DISCRIMINATORS, {
        stringValues: enumValues.filter((v) => typeof v === "string")
      });
    }
    return transformDecoder(prefix, (value) => {
      const discriminator = Number(value);
      const index = getEnumIndexFromDiscriminator({
        discriminator,
        enumKeys,
        enumValues,
        useValuesAsDiscriminators
      });
      if(index < 0) {
        const validDiscriminators = useValuesAsDiscriminators ? numericalValues : [...Array(enumKeys.length).keys()];
        throw new SolanaError(SOLANA_ERROR__CODECS__ENUM_DISCRIMINATOR_OUT_OF_RANGE, {
          discriminator,
          formattedValidDiscriminators: formatNumericalValues(validDiscriminators),
          validDiscriminators
        });
      }
      return enumValues[index];
    });
  }

  function getEnumCodec(constructor, config = {}) {
    return combineCodec(getEnumEncoder(constructor, config), getEnumDecoder(constructor, config));
  }

  var getScalarEnumEncoder = getEnumEncoder;
  var getScalarEnumDecoder = getEnumDecoder;
  var getScalarEnumCodec = getEnumCodec;

  function getHiddenPrefixEncoder(encoder, prefixedEncoders) {
    return transformEncoder(
      getTupleEncoder([...prefixedEncoders, encoder]),
      (value) => [...prefixedEncoders.map(() => void 0), value]
    );
  }

  function getHiddenPrefixDecoder(decoder, prefixedDecoders) {
    return transformDecoder(
      getTupleDecoder([...prefixedDecoders, decoder]),
      (tuple) => tuple[tuple.length - 1]
    );
  }

  function getHiddenPrefixCodec(codec, prefixedCodecs) {
    return combineCodec(getHiddenPrefixEncoder(codec, prefixedCodecs), getHiddenPrefixDecoder(codec, prefixedCodecs));
  }

  function getHiddenSuffixEncoder(encoder, suffixedEncoders) {
    return transformEncoder(
      getTupleEncoder([encoder, ...suffixedEncoders]),
      (value) => [value, ...suffixedEncoders.map(() => void 0)]
    );
  }

  function getHiddenSuffixDecoder(decoder, suffixedDecoders) {
    return transformDecoder(
      getTupleDecoder([decoder, ...suffixedDecoders]),
      (tuple) => tuple[0]
    );
  }

  function getHiddenSuffixCodec(codec, suffixedCodecs) {
    return combineCodec(getHiddenSuffixEncoder(codec, suffixedCodecs), getHiddenSuffixDecoder(codec, suffixedCodecs));
  }

  function getMapEncoder(key, value, config = {}) {
    return transformEncoder(
      getArrayEncoder(getTupleEncoder([key, value]), config),
      (map) => [...map.entries()]
    );
  }

  function getMapDecoder(key, value, config = {}) {
    return transformDecoder(
      getArrayDecoder(getTupleDecoder([key, value]), config),
      (entries) => new Map(entries)
    );
  }

  function getMapCodec(key, value, config = {}) {
    return combineCodec(getMapEncoder(key, value, config), getMapDecoder(key, value, config));
  }

  function getUnitEncoder() {
    return createEncoder({
      fixedSize: 0,
      write: (_value, _bytes, offset) => offset
    });
  }

  function getUnitDecoder() {
    return createDecoder({
      fixedSize: 0,
      read: (_bytes, offset) => [void 0, offset]
    });
  }

  function getUnitCodec() {
    return combineCodec(getUnitEncoder(), getUnitDecoder());
  }

  function getNullableEncoder(item, config = {}) {
    const prefix = (() => {
      var _a;
      if(config.prefix === null) {
        return transformEncoder(getUnitEncoder(), (_boolean) => void 0);
      }
      return getBooleanEncoder({size: (_a = config.prefix) != null ? _a : getU8Encoder()});
    })();
    const noneValue = (() => {
      if(config.noneValue === "zeroes") {
        assertIsFixedSize(item);
        return fixEncoderSize(getUnitEncoder(), item.fixedSize);
      }
      if(!config.noneValue) {
        return getUnitEncoder();
      }
      return getConstantEncoder(config.noneValue);
    })();
    return getUnionEncoder(
      [
        transformEncoder(getTupleEncoder([prefix, noneValue]), (_value) => [
          false,
          void 0
        ]),
        transformEncoder(getTupleEncoder([prefix, item]), (value) => [true, value])
      ],
      (variant) => Number(variant !== null)
    );
  }

  function getNullableDecoder(item, config = {}) {
    const prefix = (() => {
      var _a;
      if(config.prefix === null) {
        return transformDecoder(getUnitDecoder(), () => false);
      }
      return getBooleanDecoder({size: (_a = config.prefix) != null ? _a : getU8Decoder()});
    })();
    const noneValue = (() => {
      if(config.noneValue === "zeroes") {
        assertIsFixedSize(item);
        return fixDecoderSize(getUnitDecoder(), item.fixedSize);
      }
      if(!config.noneValue) {
        return getUnitDecoder();
      }
      return getConstantDecoder(config.noneValue);
    })();
    return getUnionDecoder(
      [
        transformDecoder(getTupleDecoder([prefix, noneValue]), () => null),
        transformDecoder(getTupleDecoder([prefix, item]), ([, value]) => value)
      ],
      (bytes, offset) => {
        if(config.prefix === null && !config.noneValue) {
          return Number(offset < bytes.length);
        }
        if(config.prefix === null && config.noneValue != null) {
          const zeroValue = config.noneValue === "zeroes" ? new Uint8Array(noneValue.fixedSize).fill(0) : config.noneValue;
          return containsBytes(bytes, zeroValue, offset) ? 0 : 1;
        }
        return Number(prefix.read(bytes, offset)[0]);
      }
    );
  }

  function getNullableCodec(item, config = {}) {
    return combineCodec(
      getNullableEncoder(item, config),
      getNullableDecoder(item, config)
    );
  }

  function getSetEncoder(item, config = {}) {
    return transformEncoder(getArrayEncoder(item, config), (set) => [...set]);
  }

  function getSetDecoder(item, config = {}) {
    return transformDecoder(getArrayDecoder(item, config), (entries) => new Set(entries));
  }

  function getSetCodec(item, config = {}) {
    return combineCodec(getSetEncoder(item, config), getSetDecoder(item, config));
  }

  function getStructEncoder(fields) {
    var _a;
    const fieldCodecs = fields.map(([, codec]) => codec);
    const fixedSize = sumCodecSizes(fieldCodecs.map(getFixedSize));
    const maxSize = (_a = sumCodecSizes(fieldCodecs.map(getMaxSize))) != null ? _a : void 0;
    return createEncoder({
      ...fixedSize === null ? {
        getSizeFromValue: (value) => fields.map(([key, codec]) => getEncodedSize(value[key], codec)).reduce((all, one) => all + one, 0),
        maxSize
      } : {fixedSize},
      write: (struct, bytes, offset) => {
        fields.forEach(([key, codec]) => {
          offset = codec.write(struct[key], bytes, offset);
        });
        return offset;
      }
    });
  }

  function getStructDecoder(fields) {
    var _a;
    const fieldCodecs = fields.map(([, codec]) => codec);
    const fixedSize = sumCodecSizes(fieldCodecs.map(getFixedSize));
    const maxSize = (_a = sumCodecSizes(fieldCodecs.map(getMaxSize))) != null ? _a : void 0;
    return createDecoder({
      ...fixedSize === null ? {maxSize} : {fixedSize},
      read: (bytes, offset) => {
        const struct = {};
        fields.forEach(([key, codec]) => {
          const [value, newOffset] = codec.read(bytes, offset);
          offset = newOffset;
          struct[key] = value;
        });
        return [struct, offset];
      }
    });
  }

  function getStructCodec(fields) {
    return combineCodec(
      getStructEncoder(fields),
      getStructDecoder(fields)
    );
  }

  // ../options/dist/index.browser.mjs
  var some = (value) => ({__option: "Some", value});
  var none = () => ({__option: "None"});
  var isOption = (input) => !!(input && typeof input === "object" && "__option" in input && (input.__option === "Some" && "value" in input || input.__option === "None"));
  var isSome = (option) => option.__option === "Some";
  var isNone = (option) => option.__option === "None";

  function unwrapOption(option, fallback) {
    if(isSome(option)) return option.value;
    return fallback ? fallback() : null;
  }

  var wrapNullable = (nullable) => nullable !== null ? some(nullable) : none();

  function getOptionEncoder(item, config = {}) {
    const prefix = (() => {
      var _a;
      if(config.prefix === null) {
        return transformEncoder(getUnitEncoder(), (_boolean) => void 0);
      }
      return getBooleanEncoder({size: (_a = config.prefix) != null ? _a : getU8Encoder()});
    })();
    const noneValue = (() => {
      if(config.noneValue === "zeroes") {
        assertIsFixedSize(item);
        return fixEncoderSize(getUnitEncoder(), item.fixedSize);
      }
      if(!config.noneValue) {
        return getUnitEncoder();
      }
      return getConstantEncoder(config.noneValue);
    })();
    return getUnionEncoder(
      [
        transformEncoder(getTupleEncoder([prefix, noneValue]), (_value) => [
          false,
          void 0
        ]),
        transformEncoder(getTupleEncoder([prefix, item]), (value) => [
          true,
          isOption(value) && isSome(value) ? value.value : value
        ])
      ],
      (variant) => {
        const option = isOption(variant) ? variant : wrapNullable(variant);
        return Number(isSome(option));
      }
    );
  }

  function getOptionDecoder(item, config = {}) {
    const prefix = (() => {
      var _a;
      if(config.prefix === null) {
        return transformDecoder(getUnitDecoder(), () => false);
      }
      return getBooleanDecoder({size: (_a = config.prefix) != null ? _a : getU8Decoder()});
    })();
    const noneValue = (() => {
      if(config.noneValue === "zeroes") {
        assertIsFixedSize(item);
        return fixDecoderSize(getUnitDecoder(), item.fixedSize);
      }
      if(!config.noneValue) {
        return getUnitDecoder();
      }
      return getConstantDecoder(config.noneValue);
    })();
    return getUnionDecoder(
      [
        transformDecoder(getTupleDecoder([prefix, noneValue]), () => none()),
        transformDecoder(getTupleDecoder([prefix, item]), ([, value]) => some(value))
      ],
      (bytes, offset) => {
        if(config.prefix === null && !config.noneValue) {
          return Number(offset < bytes.length);
        }
        if(config.prefix === null && config.noneValue != null) {
          const zeroValue = config.noneValue === "zeroes" ? new Uint8Array(noneValue.fixedSize).fill(0) : config.noneValue;
          return containsBytes(bytes, zeroValue, offset) ? 0 : 1;
        }
        return Number(prefix.read(bytes, offset)[0]);
      }
    );
  }

  function getOptionCodec(item, config = {}) {
    return combineCodec(
      getOptionEncoder(item, config),
      getOptionDecoder(item, config)
    );
  }

  function unwrapOptionRecursively(input, fallback) {
    if(!input || ArrayBuffer.isView(input)) {
      return input;
    }
    const next = (x) => fallback ? unwrapOptionRecursively(x, fallback) : unwrapOptionRecursively(x);
    if(isOption(input)) {
      if(isSome(input)) return next(input.value);
      return fallback ? fallback() : null;
    }
    if(Array.isArray(input)) {
      return input.map(next);
    }
    if(typeof input === "object") {
      return Object.fromEntries(Object.entries(input).map(([k, v]) => [k, next(v)]));
    }
    return input;
  }

  // ../functional/dist/index.browser.mjs
  function pipe(init, ...fns) {
    return fns.reduce((acc, fn) => fn(acc), init);
  }

  // ../instructions/dist/index.browser.mjs
  function isInstructionForProgram(instruction, programAddress) {
    return instruction.programAddress === programAddress;
  }

  function assertIsInstructionForProgram(instruction, programAddress) {
    if(instruction.programAddress !== programAddress) {
      throw new SolanaError(SOLANA_ERROR__INSTRUCTION__PROGRAM_ID_MISMATCH, {
        actualProgramAddress: instruction.programAddress,
        expectedProgramAddress: programAddress
      });
    }
  }

  function isInstructionWithAccounts(instruction) {
    return instruction.accounts !== void 0;
  }

  function assertIsInstructionWithAccounts(instruction) {
    if(instruction.accounts === void 0) {
      throw new SolanaError(SOLANA_ERROR__INSTRUCTION__EXPECTED_TO_HAVE_ACCOUNTS, {
        data: instruction.data,
        programAddress: instruction.programAddress
      });
    }
  }

  function isInstructionWithData(instruction) {
    return instruction.data !== void 0;
  }

  function assertIsInstructionWithData(instruction) {
    var _a;
    if(instruction.data === void 0) {
      throw new SolanaError(SOLANA_ERROR__INSTRUCTION__EXPECTED_TO_HAVE_DATA, {
        accountAddresses: (_a = instruction.accounts) == null ? void 0 : _a.map((a) => a.address),
        programAddress: instruction.programAddress
      });
    }
  }

  var AccountRole = /* @__PURE__ */ ((AccountRole2) => {
    AccountRole2[AccountRole2["WRITABLE_SIGNER"] = /* 3 */
      3] = "WRITABLE_SIGNER";
    AccountRole2[AccountRole2["READONLY_SIGNER"] = /* 2 */
      2] = "READONLY_SIGNER";
    AccountRole2[AccountRole2["WRITABLE"] = /* 1 */
      1] = "WRITABLE";
    AccountRole2[AccountRole2["READONLY"] = /* 0 */
      0] = "READONLY";
    return AccountRole2;
  })(AccountRole || {});
  var IS_SIGNER_BITMASK = 2;
  var IS_WRITABLE_BITMASK = 1;

  function downgradeRoleToNonSigner(role) {
    return role & ~IS_SIGNER_BITMASK;
  }

  function downgradeRoleToReadonly(role) {
    return role & ~IS_WRITABLE_BITMASK;
  }

  function isSignerRole(role) {
    return role >= 2;
  }

  function isWritableRole(role) {
    return (role & IS_WRITABLE_BITMASK) !== 0;
  }

  function mergeRoles(roleA, roleB) {
    return roleA | roleB;
  }

  function upgradeRoleToSigner(role) {
    return role | IS_SIGNER_BITMASK;
  }

  function upgradeRoleToWritable(role) {
    return role | IS_WRITABLE_BITMASK;
  }

  // ../keys/dist/index.browser.mjs
  function addPkcs8Header(bytes) {
    return new Uint8Array([
      /**
       * PKCS#8 header
       */
      48,
      // ASN.1 sequence tag
      46,
      // Length of sequence (46 more bytes)
      2,
      // ASN.1 integer tag
      1,
      // Length of integer
      0,
      // Version number
      48,
      // ASN.1 sequence tag
      5,
      // Length of sequence
      6,
      // ASN.1 object identifier tag
      3,
      // Length of object identifier
      // Edwards curve algorithms identifier https://oid-rep.orange-labs.fr/get/1.3.101.112
      43,
      // iso(1) / identified-organization(3) (The first node is multiplied by the decimal 40 and the result is added to the value of the second node)
      101,
      // thawte(101)
      // Ed25519 identifier
      112,
      // id-Ed25519(112)
      /**
       * Private key payload
       */
      4,
      // ASN.1 octet string tag
      34,
      // String length (34 more bytes)
      // Private key bytes as octet string
      4,
      // ASN.1 octet string tag
      32,
      // String length (32 bytes)
      ...bytes
    ]);
  }

  function createPrivateKeyFromBytes(bytes, extractable) {
    const actualLength = bytes.byteLength;
    if(actualLength !== 32) {
      throw new SolanaError(SOLANA_ERROR__KEYS__INVALID_PRIVATE_KEY_BYTE_LENGTH, {
        actualLength
      });
    }
    const privateKeyBytesPkcs8 = addPkcs8Header(bytes);
    return crypto.subtle.importKey("pkcs8", privateKeyBytesPkcs8, "Ed25519", extractable != null ? extractable : false, ["sign"]);
  }

  function getPublicKeyFromPrivateKey(privateKey, extractable = false) {
    assertKeyExporterIsAvailable();
    if(privateKey.extractable === false) {
      throw new SolanaError(SOLANA_ERROR__SUBTLE_CRYPTO__CANNOT_EXPORT_NON_EXTRACTABLE_KEY, {key: privateKey});
    }
    const jwk = crypto.subtle.exportKey("jwk", privateKey);
    return crypto.subtle.importKey(
      "jwk",
      {
        crv: "Ed25519",
        ext: extractable,
        key_ops: ["verify"],
        kty: "OKP",
        x: jwk.x
      },
      "Ed25519",
      extractable,
      ["verify"]
    );
  }

  var base58Encoder;

  function assertIsSignature(putativeSignature) {
    if(!base58Encoder) base58Encoder = getBase58Encoder();
    if(
      // Lowest value (64 bytes of zeroes)
      putativeSignature.length < 64 || // Highest value (64 bytes of 255)
      putativeSignature.length > 88
    ) {
      throw new SolanaError(SOLANA_ERROR__KEYS__SIGNATURE_STRING_LENGTH_OUT_OF_RANGE, {
        actualLength: putativeSignature.length
      });
    }
    const bytes = base58Encoder.encode(putativeSignature);
    const numBytes = bytes.byteLength;
    if(numBytes !== 64) {
      throw new SolanaError(SOLANA_ERROR__KEYS__INVALID_SIGNATURE_BYTE_LENGTH, {
        actualLength: numBytes
      });
    }
  }

  function isSignature(putativeSignature) {
    if(!base58Encoder) base58Encoder = getBase58Encoder();
    if(
      // Lowest value (64 bytes of zeroes)
      putativeSignature.length < 64 || // Highest value (64 bytes of 255)
      putativeSignature.length > 88
    ) {
      return false;
    }
    const bytes = base58Encoder.encode(putativeSignature);
    const numBytes = bytes.byteLength;
    if(numBytes !== 64) {
      return false;
    }
    return true;
  }

  function signBytes(key, data) {
    assertSigningCapabilityIsAvailable();
    const signedData = crypto.subtle.sign("Ed25519", key, data);
    return new Uint8Array(signedData);
  }

  function signature(putativeSignature) {
    assertIsSignature(putativeSignature);
    return putativeSignature;
  }

  function verifySignature(key, signature2, data) {
    assertVerificationCapabilityIsAvailable();
    return crypto.subtle.verify("Ed25519", key, signature2, data);
  }

  function generateKeyPair() {
    assertKeyGenerationIsAvailable();
    const keyPair = crypto.subtle.generateKey(
      /* algorithm */
      "Ed25519",
      // Native implementation status: https://github.com/WICG/webcrypto-secure-curves/issues/20
      /* extractable */
      false,
      // Prevents the bytes of the private key from being visible to JS.
      /* allowed uses */
      ["sign", "verify"]
    );
    return keyPair;
  }

  function createKeyPairFromBytes(bytes, extractable) {
    assertPRNGIsAvailable();
    if(bytes.byteLength !== 64) {
      throw new SolanaError(SOLANA_ERROR__KEYS__INVALID_KEY_PAIR_BYTE_LENGTH, {byteLength: bytes.byteLength});
    }
    const [publicKey, privateKey] = [
      crypto.subtle.importKey("raw", bytes.slice(32), "Ed25519", /* extractable */ true, ["verify"]),
      createPrivateKeyFromBytes(bytes.slice(0, 32), extractable)
    ];
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const signedData = signBytes(privateKey, randomBytes);
    const isValid = verifySignature(publicKey, signedData, randomBytes);
    if(!isValid) {
      throw new SolanaError(SOLANA_ERROR__KEYS__PUBLIC_KEY_MUST_MATCH_PRIVATE_KEY);
    }
    return {privateKey, publicKey};
  }

  function createKeyPairFromPrivateKeyBytes(bytes, extractable = false) {
    const pk = createPrivateKeyFromBytes(bytes, extractable);
    // This nested promise makes things efficient by
    // creating the public key in parallel with the
    // second private key creation, if it is needed.
    const [publicKey, privateKey] = [
      (extractable ? pk : getPublicKeyFromPrivateKey(createPrivateKeyFromBytes(bytes, true), true)),
      pk
    ];
    return {privateKey, publicKey};
  }

  // ../programs/dist/index.browser.mjs
  function isProgramError(error, transactionMessage, programAddress, code) {
    var _a;
    if(!isSolanaError(error, SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM)) {
      return false;
    }
    const instructionProgramAddress = (_a = transactionMessage.instructions[error.context.index]) == null ? void 0 : _a.programAddress;
    if(!instructionProgramAddress || instructionProgramAddress !== programAddress) {
      return false;
    }
    return typeof code === "undefined" || error.context.code === code;
  }

  // ../rpc-spec-types/dist/index.browser.mjs
  function parseJsonWithBigInts(json) {
    return JSON.parse(wrapIntegersInBigIntValueObject(json), (_, value) => {
      return isBigIntValueObject(value) ? unwrapBigIntValueObject(value) : value;
    });
  }

  function wrapIntegersInBigIntValueObject(json) {
    const out = [];
    let inQuote = false;
    for(let ii = 0; ii < json.length; ii++) {
      let isEscaped = false;
      if(json[ii] === "\\") {
        out.push(json[ii++]);
        isEscaped = !isEscaped;
      }
      if(json[ii] === '"') {
        out.push(json[ii]);
        if(!isEscaped) {
          inQuote = !inQuote;
        }
        continue;
      }
      if(!inQuote) {
        const consumedNumber = consumeNumber(json, ii);
        if(consumedNumber == null ? void 0 : consumedNumber.length) {
          ii += consumedNumber.length - 1;
          if(consumedNumber.match(/\.|[eE]-/)) {
            out.push(consumedNumber);
          }
          else {
            out.push(wrapBigIntValueObject(consumedNumber));
          }
          continue;
        }
      }
      out.push(json[ii]);
    }
    return out.join("");
  }

  function consumeNumber(json, ii) {
    var _a;
    const JSON_NUMBER_REGEX = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/;
    if(!((_a = json[ii]) == null ? void 0 : _a.match(/[-\d]/))) {
      return null;
    }
    const numberMatch = json.slice(ii).match(JSON_NUMBER_REGEX);
    return numberMatch ? numberMatch[0] : null;
  }

  function wrapBigIntValueObject(value) {
    return `{"$n":"${value}"}`;
  }

  function unwrapBigIntValueObject({$n}) {
    if($n.match(/[eE]/)) {
      const [units, exponent] = $n.split(/[eE]/);
      return BigInt(units) * BigInt(10) ** BigInt(exponent);
    }
    return BigInt($n);
  }

  function isBigIntValueObject(value) {
    return !!value && typeof value === "object" && "$n" in value && typeof value.$n === "string";
  }

  var _nextMessageId = 0n;

  function getNextMessageId() {
    const id = _nextMessageId;
    _nextMessageId++;
    return id.toString();
  }

  function createRpcMessage(request) {
    return {
      id: getNextMessageId(),
      jsonrpc: "2.0",
      method: request.methodName,
      params: request.params
    };
  }

  function stringifyJsonWithBigints(value, space) {
    return unwrapBigIntValueObject2(
      JSON.stringify(value, (_, v) => typeof v === "bigint" ? wrapBigIntValueObject2(v) : v, space)
    );
  }

  function wrapBigIntValueObject2(value) {
    return {$n: `${value}`};
  }

  function unwrapBigIntValueObject2(value) {
    return value.replace(/\{\s*"\$n"\s*:\s*"(-?\d+)"\s*\}/g, "$1");
  }

  // ../rpc-spec/dist/index.browser.mjs
  function createRpc(rpcConfig) {
    return makeProxy(rpcConfig);
  }

  function makeProxy(rpcConfig) {
    return new Proxy(rpcConfig.api, {
      defineProperty() {
        return false;
      },
      deleteProperty() {
        return false;
      },
      get(target, p, receiver) {
        return function(...rawParams) {
          const methodName = p.toString();
          const getApiPlan = Reflect.get(target, methodName, receiver);
          if(!getApiPlan) {
            throw new SolanaError(SOLANA_ERROR__RPC__API_PLAN_MISSING_FOR_RPC_METHOD, {
              method: methodName,
              params: rawParams
            });
          }
          const apiPlan = getApiPlan(...rawParams);
          return createPendingRpcRequest(rpcConfig, apiPlan);
        };
      }
    });
  }

  function createPendingRpcRequest({transport}, plan) {
    return {
      send(options) {
        return plan.execute({signal: options == null ? void 0 : options.abortSignal, transport});
      }
    };
  }

  function createJsonRpcApi(config) {
    return new Proxy({}, {
      defineProperty() {
        return false;
      },
      deleteProperty() {
        return false;
      },
      get(...args) {
        const [_, p] = args;
        const methodName = p.toString();
        return function(...rawParams) {
          const rawRequest = Object.freeze({methodName, params: rawParams});
          const request = (config == null ? void 0 : config.requestTransformer) ? config == null ? void 0 : config.requestTransformer(rawRequest) : rawRequest;
          return Object.freeze({
            execute: ({signal, transport}) => {
              const payload = createRpcMessage(request);
              const response = transport({payload, signal});
              if(!(config == null ? void 0 : config.responseTransformer)) {
                return response;
              }
              return config.responseTransformer(response, request);
            }
          });
        };
      }
    });
  }

  function isJsonRpcPayload(payload) {
    if(payload == null || typeof payload !== "object" || Array.isArray(payload)) {
      return false;
    }
    return "jsonrpc" in payload && payload.jsonrpc === "2.0" && "method" in payload && typeof payload.method === "string" && "params" in payload;
  }

  // ../rpc-transformers/dist/index.browser.mjs
  var KEYPATH_WILDCARD = {};

  function getTreeWalker(visitors) {
    return function traverse(node, state) {
      if(Array.isArray(node)) {
        return node.map((element, ii) => {
          const nextState = {
            ...state,
            keyPath: [...state.keyPath, ii]
          };
          return traverse(element, nextState);
        });
      }
      else if(typeof node === "object" && node !== null) {
        const out = {};
        for(const propName in node) {
          if(!Object.prototype.hasOwnProperty.call(node, propName)) {
            continue;
          }
          const nextState = {
            ...state,
            keyPath: [...state.keyPath, propName]
          };
          out[propName] = traverse(node[propName], nextState);
        }
        return out;
      }
      else {
        return visitors.reduce((acc, visitNode) => visitNode(acc, state), node);
      }
    };
  }

  function getTreeWalkerRequestTransformer(visitors, initialState) {
    return (request) => {
      const traverse = getTreeWalker(visitors);
      return Object.freeze({
        ...request,
        params: traverse(request.params, initialState)
      });
    };
  }

  function getTreeWalkerResponseTransformer(visitors, initialState) {
    return (json) => getTreeWalker(visitors)(json, initialState);
  }

  function getBigIntDowncastRequestTransformer() {
    return getTreeWalkerRequestTransformer([downcastNodeToNumberIfBigint], {keyPath: []});
  }

  function downcastNodeToNumberIfBigint(value) {
    return typeof value === "bigint" ? (
      // FIXME(solana-labs/solana/issues/30341) Create a data type to represent u64 in the Solana
      // JSON RPC implementation so that we can throw away this entire patcher instead of unsafely
      // downcasting `bigints` to `numbers`.
      Number(value)
    ) : value;
  }

  function getDefaultCommitmentRequestTransformer({
    defaultCommitment,
    optionsObjectPositionByMethod
  }) {
    return (request) => {
      const {params, methodName} = request;
      if(!Array.isArray(params)) {
        return request;
      }
      const optionsObjectPositionInParams = optionsObjectPositionByMethod[methodName];
      if(optionsObjectPositionInParams == null) {
        return request;
      }
      return Object.freeze({
        methodName,
        params: applyDefaultCommitment({
          commitmentPropertyName: methodName === "sendTransaction" ? "preflightCommitment" : "commitment",
          optionsObjectPositionInParams,
          overrideCommitment: defaultCommitment,
          params
        })
      });
    };
  }

  function applyDefaultCommitment({
    commitmentPropertyName,
    params,
    optionsObjectPositionInParams,
    overrideCommitment
  }) {
    const paramInTargetPosition = params[optionsObjectPositionInParams];
    if(
      // There's no config.
      paramInTargetPosition === void 0 || // There is a config object.
      paramInTargetPosition && typeof paramInTargetPosition === "object" && !Array.isArray(paramInTargetPosition)
    ) {
      if(
        // The config object already has a commitment set.
        paramInTargetPosition && commitmentPropertyName in paramInTargetPosition
      ) {
        if(!paramInTargetPosition[commitmentPropertyName] || paramInTargetPosition[commitmentPropertyName] === "finalized") {
          const nextParams = [...params];
          const {
            [commitmentPropertyName]: _,
            // eslint-disable-line @typescript-eslint/no-unused-vars
            ...rest
          } = paramInTargetPosition;
          if(Object.keys(rest).length > 0) {
            nextParams[optionsObjectPositionInParams] = rest;
          }
          else {
            if(optionsObjectPositionInParams === nextParams.length - 1) {
              nextParams.length--;
            }
            else {
              nextParams[optionsObjectPositionInParams] = void 0;
            }
          }
          return nextParams;
        }
      }
      else if(overrideCommitment !== "finalized") {
        const nextParams = [...params];
        nextParams[optionsObjectPositionInParams] = {
          ...paramInTargetPosition,
          [commitmentPropertyName]: overrideCommitment
        };
        return nextParams;
      }
    }
    return params;
  }

  function getIntegerOverflowRequestTransformer(onIntegerOverflow) {
    return (request) => {
      const transformer = getTreeWalkerRequestTransformer(
        [getIntegerOverflowNodeVisitor((...args) => onIntegerOverflow(request, ...args))],
        {keyPath: []}
      );
      return transformer(request);
    };
  }

  function getIntegerOverflowNodeVisitor(onIntegerOverflow) {
    return (value, {keyPath}) => {
      if(typeof value === "bigint") {
        if(onIntegerOverflow && (value > Number.MAX_SAFE_INTEGER || value < -Number.MAX_SAFE_INTEGER)) {
          onIntegerOverflow(keyPath, value);
        }
      }
      return value;
    };
  }

  var OPTIONS_OBJECT_POSITION_BY_METHOD = {
    accountNotifications: 1,
    blockNotifications: 1,
    getAccountInfo: 1,
    getBalance: 1,
    getBlock: 1,
    getBlockHeight: 0,
    getBlockProduction: 0,
    getBlocks: 2,
    getBlocksWithLimit: 2,
    getEpochInfo: 0,
    getFeeForMessage: 1,
    getInflationGovernor: 0,
    getInflationReward: 1,
    getLargestAccounts: 0,
    getLatestBlockhash: 0,
    getLeaderSchedule: 1,
    getMinimumBalanceForRentExemption: 1,
    getMultipleAccounts: 1,
    getProgramAccounts: 1,
    getSignaturesForAddress: 1,
    getSlot: 0,
    getSlotLeader: 0,
    getStakeMinimumDelegation: 0,
    getSupply: 0,
    getTokenAccountBalance: 1,
    getTokenAccountsByDelegate: 2,
    getTokenAccountsByOwner: 2,
    getTokenLargestAccounts: 1,
    getTokenSupply: 1,
    getTransaction: 1,
    getTransactionCount: 0,
    getVoteAccounts: 0,
    isBlockhashValid: 1,
    logsNotifications: 1,
    programNotifications: 1,
    requestAirdrop: 2,
    sendTransaction: 1,
    signatureNotifications: 1,
    simulateTransaction: 1
  };

  function getDefaultRequestTransformerForSolanaRpc(config) {
    const handleIntegerOverflow = config == null ? void 0 : config.onIntegerOverflow;
    return (request) => {
      return pipe(
        request,
        handleIntegerOverflow ? getIntegerOverflowRequestTransformer(handleIntegerOverflow) : (r) => r,
        getBigIntDowncastRequestTransformer(),
        getDefaultCommitmentRequestTransformer({
          defaultCommitment: config == null ? void 0 : config.defaultCommitment,
          optionsObjectPositionByMethod: OPTIONS_OBJECT_POSITION_BY_METHOD
        })
      );
    };
  }

  function getBigIntUpcastResponseTransformer(allowedNumericKeyPaths) {
    return getTreeWalkerResponseTransformer([getBigIntUpcastVisitor(allowedNumericKeyPaths)], {keyPath: []});
  }

  function getBigIntUpcastVisitor(allowedNumericKeyPaths) {
    return function upcastNodeToBigIntIfNumber(value, {keyPath}) {
      const isInteger = typeof value === "number" && Number.isInteger(value) || typeof value === "bigint";
      if(!isInteger) return value;
      if(keyPathIsAllowedToBeNumeric(keyPath, allowedNumericKeyPaths)) {
        return Number(value);
      }
      else {
        return BigInt(value);
      }
    };
  }

  function keyPathIsAllowedToBeNumeric(keyPath, allowedNumericKeyPaths) {
    return allowedNumericKeyPaths.some((prohibitedKeyPath) => {
      if(prohibitedKeyPath.length !== keyPath.length) {
        return false;
      }
      for(let ii = keyPath.length - 1; ii >= 0; ii--) {
        const keyPathPart = keyPath[ii];
        const prohibitedKeyPathPart = prohibitedKeyPath[ii];
        if(prohibitedKeyPathPart !== keyPathPart && (prohibitedKeyPathPart !== KEYPATH_WILDCARD || typeof keyPathPart !== "number")) {
          return false;
        }
      }
      return true;
    });
  }

  function getResultResponseTransformer() {
    return (json) => json.result;
  }

  function getThrowSolanaErrorResponseTransformer() {
    return (json) => {
      const jsonRpcResponse = json;
      if("error" in jsonRpcResponse) {
        throw getSolanaErrorFromJsonRpcError(jsonRpcResponse.error);
      }
      return jsonRpcResponse;
    };
  }

  function getDefaultResponseTransformerForSolanaRpc(config) {
    return (response, request) => {
      const methodName = request.methodName;
      const keyPaths = (config == null ? void 0 : config.allowedNumericKeyPaths) && methodName ? config.allowedNumericKeyPaths[methodName] : void 0;
      return pipe(
        response,
        (r) => getThrowSolanaErrorResponseTransformer()(r, request),
        (r) => getResultResponseTransformer()(r, request),
        (r) => getBigIntUpcastResponseTransformer(keyPaths != null ? keyPaths : [])(r, request)
      );
    };
  }

  var jsonParsedTokenAccountsConfigs = [
    // parsed Token/Token22 token account
    ["data", "parsed", "info", "tokenAmount", "decimals"],
    ["data", "parsed", "info", "tokenAmount", "uiAmount"],
    ["data", "parsed", "info", "rentExemptReserve", "decimals"],
    ["data", "parsed", "info", "rentExemptReserve", "uiAmount"],
    ["data", "parsed", "info", "delegatedAmount", "decimals"],
    ["data", "parsed", "info", "delegatedAmount", "uiAmount"],
    ["data", "parsed", "info", "extensions", KEYPATH_WILDCARD, "state", "olderTransferFee", "transferFeeBasisPoints"],
    ["data", "parsed", "info", "extensions", KEYPATH_WILDCARD, "state", "newerTransferFee", "transferFeeBasisPoints"],
    ["data", "parsed", "info", "extensions", KEYPATH_WILDCARD, "state", "preUpdateAverageRate"],
    ["data", "parsed", "info", "extensions", KEYPATH_WILDCARD, "state", "currentRate"]
  ];
  var jsonParsedAccountsConfigs = [
    ...jsonParsedTokenAccountsConfigs,
    // parsed AddressTableLookup account
    ["data", "parsed", "info", "lastExtendedSlotStartIndex"],
    // parsed Config account
    ["data", "parsed", "info", "slashPenalty"],
    ["data", "parsed", "info", "warmupCooldownRate"],
    // parsed Token/Token22 mint account
    ["data", "parsed", "info", "decimals"],
    // parsed Token/Token22 multisig account
    ["data", "parsed", "info", "numRequiredSigners"],
    ["data", "parsed", "info", "numValidSigners"],
    // parsed Stake account
    ["data", "parsed", "info", "stake", "delegation", "warmupCooldownRate"],
    // parsed Sysvar rent account
    ["data", "parsed", "info", "exemptionThreshold"],
    ["data", "parsed", "info", "burnPercent"],
    // parsed Vote account
    ["data", "parsed", "info", "commission"],
    ["data", "parsed", "info", "votes", KEYPATH_WILDCARD, "confirmationCount"]
  ];
  var innerInstructionsConfigs = [
    ["index"],
    ["instructions", KEYPATH_WILDCARD, "accounts", KEYPATH_WILDCARD],
    ["instructions", KEYPATH_WILDCARD, "programIdIndex"],
    ["instructions", KEYPATH_WILDCARD, "stackHeight"]
  ];
  var messageConfig = [
    ["addressTableLookups", KEYPATH_WILDCARD, "writableIndexes", KEYPATH_WILDCARD],
    ["addressTableLookups", KEYPATH_WILDCARD, "readonlyIndexes", KEYPATH_WILDCARD],
    ["header", "numReadonlySignedAccounts"],
    ["header", "numReadonlyUnsignedAccounts"],
    ["header", "numRequiredSignatures"],
    ["instructions", KEYPATH_WILDCARD, "accounts", KEYPATH_WILDCARD],
    ["instructions", KEYPATH_WILDCARD, "programIdIndex"],
    ["instructions", KEYPATH_WILDCARD, "stackHeight"]
  ];

  // ../rpc-api/dist/index.browser.mjs
  function createSolanaRpcApi(config) {
    return createJsonRpcApi({
      requestTransformer: getDefaultRequestTransformerForSolanaRpc(config),
      responseTransformer: getDefaultResponseTransformerForSolanaRpc({
        allowedNumericKeyPaths: getAllowedNumericKeypaths()
      })
    });
  }

  var memoizedKeypaths;

  function getAllowedNumericKeypaths() {
    if(!memoizedKeypaths) {
      memoizedKeypaths = {
        getAccountInfo: jsonParsedAccountsConfigs.map((c) => ["value", ...c]),
        getBlock: [
          ["transactions", KEYPATH_WILDCARD, "meta", "preTokenBalances", KEYPATH_WILDCARD, "accountIndex"],
          [
            "transactions",
            KEYPATH_WILDCARD,
            "meta",
            "preTokenBalances",
            KEYPATH_WILDCARD,
            "uiTokenAmount",
            "decimals"
          ],
          ["transactions", KEYPATH_WILDCARD, "meta", "postTokenBalances", KEYPATH_WILDCARD, "accountIndex"],
          [
            "transactions",
            KEYPATH_WILDCARD,
            "meta",
            "postTokenBalances",
            KEYPATH_WILDCARD,
            "uiTokenAmount",
            "decimals"
          ],
          ["transactions", KEYPATH_WILDCARD, "meta", "rewards", KEYPATH_WILDCARD, "commission"],
          ...innerInstructionsConfigs.map((c) => [
            "transactions",
            KEYPATH_WILDCARD,
            "meta",
            "innerInstructions",
            KEYPATH_WILDCARD,
            ...c
          ]),
          ...messageConfig.map((c) => ["transactions", KEYPATH_WILDCARD, "transaction", "message", ...c]),
          ["rewards", KEYPATH_WILDCARD, "commission"]
        ],
        getClusterNodes: [
          [KEYPATH_WILDCARD, "featureSet"],
          [KEYPATH_WILDCARD, "shredVersion"]
        ],
        getInflationGovernor: [["initial"], ["foundation"], ["foundationTerm"], ["taper"], ["terminal"]],
        getInflationRate: [["foundation"], ["total"], ["validator"]],
        getInflationReward: [[KEYPATH_WILDCARD, "commission"]],
        getMultipleAccounts: jsonParsedAccountsConfigs.map((c) => ["value", KEYPATH_WILDCARD, ...c]),
        getProgramAccounts: jsonParsedAccountsConfigs.flatMap((c) => [
          ["value", KEYPATH_WILDCARD, "account", ...c],
          [KEYPATH_WILDCARD, "account", ...c]
        ]),
        getRecentPerformanceSamples: [[KEYPATH_WILDCARD, "samplePeriodSecs"]],
        getTokenAccountBalance: [
          ["value", "decimals"],
          ["value", "uiAmount"]
        ],
        getTokenAccountsByDelegate: jsonParsedTokenAccountsConfigs.map((c) => [
          "value",
          KEYPATH_WILDCARD,
          "account",
          ...c
        ]),
        getTokenAccountsByOwner: jsonParsedTokenAccountsConfigs.map((c) => [
          "value",
          KEYPATH_WILDCARD,
          "account",
          ...c
        ]),
        getTokenLargestAccounts: [
          ["value", KEYPATH_WILDCARD, "decimals"],
          ["value", KEYPATH_WILDCARD, "uiAmount"]
        ],
        getTokenSupply: [
          ["value", "decimals"],
          ["value", "uiAmount"]
        ],
        getTransaction: [
          ["meta", "preTokenBalances", KEYPATH_WILDCARD, "accountIndex"],
          ["meta", "preTokenBalances", KEYPATH_WILDCARD, "uiTokenAmount", "decimals"],
          ["meta", "postTokenBalances", KEYPATH_WILDCARD, "accountIndex"],
          ["meta", "postTokenBalances", KEYPATH_WILDCARD, "uiTokenAmount", "decimals"],
          ["meta", "rewards", KEYPATH_WILDCARD, "commission"],
          ...innerInstructionsConfigs.map((c) => ["meta", "innerInstructions", KEYPATH_WILDCARD, ...c]),
          ...messageConfig.map((c) => ["transaction", "message", ...c])
        ],
        getVersion: [["feature-set"]],
        getVoteAccounts: [
          ["current", KEYPATH_WILDCARD, "commission"],
          ["delinquent", KEYPATH_WILDCARD, "commission"]
        ],
        simulateTransaction: [
          ...jsonParsedAccountsConfigs.map((c) => ["value", "accounts", KEYPATH_WILDCARD, ...c]),
          ...innerInstructionsConfigs.map((c) => ["value", "innerInstructions", KEYPATH_WILDCARD, ...c])
        ]
      };
    }
    return memoizedKeypaths;
  }

  // ../rpc-transport-http/dist/index.browser.mjs
  var DISALLOWED_HEADERS = {
    accept: true,
    "content-length": true,
    "content-type": true
  };
  var FORBIDDEN_HEADERS = /* @__PURE__ */ Object.assign(
    {
      "accept-charset": true,
      "access-control-request-headers": true,
      "access-control-request-method": true,
      connection: true,
      "content-length": true,
      cookie: true,
      date: true,
      dnt: true,
      expect: true,
      host: true,
      "keep-alive": true,
      origin: true,
      "permissions-policy": true,
      // Prefix matching is implemented in code, below.
      // 'proxy-': true,
      // 'sec-': true,
      referer: true,
      te: true,
      trailer: true,
      "transfer-encoding": true,
      upgrade: true,
      via: true
    },
    {"accept-encoding": true}
  );

  function assertIsAllowedHttpRequestHeaders(headers) {
    const badHeaders = Object.keys(headers).filter((headerName) => {
      const lowercaseHeaderName = headerName.toLowerCase();
      return DISALLOWED_HEADERS[headerName.toLowerCase()] === true || FORBIDDEN_HEADERS[headerName.toLowerCase()] === true || lowercaseHeaderName.startsWith("proxy-") || lowercaseHeaderName.startsWith("sec-");
    });
    if(badHeaders.length > 0) {
      throw new SolanaError(SOLANA_ERROR__RPC__TRANSPORT_HTTP_HEADER_FORBIDDEN, {
        headers: badHeaders
      });
    }
  }

  function normalizeHeaders(headers) {
    const out = {};
    for(const headerName in headers) {
      out[headerName.toLowerCase()] = headers[headerName];
    }
    return out;
  }

  var didWarnDispatcherWasSuppliedInNonNodeEnvironment = false;

  function warnDispatcherWasSuppliedInNonNodeEnvironment() {
    if(didWarnDispatcherWasSuppliedInNonNodeEnvironment) {
      return;
    }
    didWarnDispatcherWasSuppliedInNonNodeEnvironment = true;
    console.warn(
      "You have supplied a `Dispatcher` to `createHttpTransport()`. It has been ignored because Undici dispatchers only work in Node environments. To eliminate this warning, omit the `dispatcher_NODE_ONLY` property from your config when running in a non-Node environment."
    );
  }

  function createHttpTransport(config) {
    if("dispatcher_NODE_ONLY" in config) {
      warnDispatcherWasSuppliedInNonNodeEnvironment();
    }
    const {fromJson, headers, toJson, url} = config;
    if(headers) {
      assertIsAllowedHttpRequestHeaders(headers);
    }
    let dispatcherConfig;
    const customHeaders = headers && normalizeHeaders(headers);
    return function makeHttpRequest({
      payload,
      signal
    }) {
      const body = toJson ? toJson(payload) : JSON.stringify(payload);
      const requestInfo = {
        url: url,
        ...dispatcherConfig,
        body,
        headers: {
          ...customHeaders,
          // Keep these headers lowercase so they will override any user-supplied headers above.
          accept: "application/json",
          "content-length": body.length.toString(),
          "content-type": "application/json; charset=utf-8"
        },
        method: "POST",
        signal
      };

      let response;
      try {
        response = fetch(requestInfo);
      } catch(e) {
        throw new SolanaError(SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR, {
          message: e.getMessage(),
          statusCode: 500
        });
      }

      if(fromJson) {
        return fromJson(response.body(), payload);
      }
      return JSON.parse(response.body());
    };
  }

  var SOLANA_RPC_METHODS = [
    "getAccountInfo",
    "getBalance",
    "getBlock",
    "getBlockCommitment",
    "getBlockHeight",
    "getBlockProduction",
    "getBlocks",
    "getBlocksWithLimit",
    "getBlockTime",
    "getClusterNodes",
    "getEpochInfo",
    "getEpochSchedule",
    "getFeeForMessage",
    "getFirstAvailableBlock",
    "getGenesisHash",
    "getHealth",
    "getHighestSnapshotSlot",
    "getIdentity",
    "getInflationGovernor",
    "getInflationRate",
    "getInflationReward",
    "getLargestAccounts",
    "getLatestBlockhash",
    "getLeaderSchedule",
    "getMaxRetransmitSlot",
    "getMaxShredInsertSlot",
    "getMinimumBalanceForRentExemption",
    "getMultipleAccounts",
    "getProgramAccounts",
    "getRecentPerformanceSamples",
    "getRecentPrioritizationFees",
    "getSignaturesForAddress",
    "getSignatureStatuses",
    "getSlot",
    "getSlotLeader",
    "getSlotLeaders",
    "getStakeMinimumDelegation",
    "getSupply",
    "getTokenAccountBalance",
    "getTokenAccountsByDelegate",
    "getTokenAccountsByOwner",
    "getTokenLargestAccounts",
    "getTokenSupply",
    "getTransaction",
    "getTransactionCount",
    "getVersion",
    "getVoteAccounts",
    "index",
    "isBlockhashValid",
    "minimumLedgerSlot",
    "requestAirdrop",
    "sendTransaction",
    "simulateTransaction"
  ];

  function isSolanaRequest(payload) {
    return isJsonRpcPayload(payload) && SOLANA_RPC_METHODS.includes(payload.method);
  }

  function createHttpTransportForSolanaRpc(config) {
    return createHttpTransport({
      ...config,
      fromJson: (rawResponse, payload) => isSolanaRequest(payload) ? parseJsonWithBigInts(rawResponse) : JSON.parse(rawResponse),
      toJson: (payload) => isSolanaRequest(payload) ? stringifyJsonWithBigints(payload) : JSON.stringify(payload)
    });
  }

  // ../fast-stable-stringify/dist/index.browser.mjs
  var objToString = Object.prototype.toString;
  var objKeys = Object.keys || function(obj) {
    const keys = [];
    for(const name in obj) {
      keys.push(name);
    }
    return keys;
  };

  function stringify(val, isArrayProp) {
    let i, max, str, keys, key, propVal, toStr;
    if(val === true) {
      return "true";
    }
    if(val === false) {
      return "false";
    }
    switch(typeof val) {
      case "object":
        if(val === null) {
          return null;
        }
        else if("toJSON" in val && typeof val.toJSON === "function") {
          return stringify(val.toJSON(), isArrayProp);
        }
        else {
          toStr = objToString.call(val);
          if(toStr === "[object Array]") {
            str = "[";
            max = val.length - 1;
            for(i = 0; i < max; i++) {
              str += stringify(val[i], true) + ",";
            }
            if(max > -1) {
              str += stringify(val[i], true);
            }
            return str + "]";
          }
          else if(toStr === "[object Object]") {
            keys = objKeys(val).sort();
            max = keys.length;
            str = "";
            i = 0;
            while(i < max) {
              key = keys[i];
              propVal = stringify(val[key], false);
              if(propVal !== void 0) {
                if(str) {
                  str += ",";
                }
                str += JSON.stringify(key) + ":" + propVal;
              }
              i++;
            }
            return "{" + str + "}";
          }
          else {
            return JSON.stringify(val);
          }
        }
      case "function":
      case "undefined":
        return isArrayProp ? null : void 0;
      case "bigint":
        return `${val.toString()}n`;
      case "string":
        return JSON.stringify(val);
      default:
        return isFinite(val) ? val : null;
    }
  }

  function src_default(val) {
    const returnVal = stringify(val, false);
    if(returnVal !== void 0) {
      return "" + returnVal;
    }
  }

  // ../rpc/dist/index.browser.mjs
  function createSolanaJsonRpcIntegerOverflowError(methodName, keyPath, value) {
    let argumentLabel = "";
    if(typeof keyPath[0] === "number") {
      const argPosition = keyPath[0] + 1;
      const lastDigit = argPosition % 10;
      const lastTwoDigits = argPosition % 100;
      if(lastDigit == 1 && lastTwoDigits != 11) {
        argumentLabel = argPosition + "st";
      }
      else if(lastDigit == 2 && lastTwoDigits != 12) {
        argumentLabel = argPosition + "nd";
      }
      else if(lastDigit == 3 && lastTwoDigits != 13) {
        argumentLabel = argPosition + "rd";
      }
      else {
        argumentLabel = argPosition + "th";
      }
    }
    else {
      argumentLabel = `\`${keyPath[0].toString()}\``;
    }
    const path = keyPath.length > 1 ? keyPath.slice(1).map((pathPart) => typeof pathPart === "number" ? `[${pathPart}]` : pathPart).join(".") : void 0;
    const error = new SolanaError(SOLANA_ERROR__RPC__INTEGER_OVERFLOW, {
      argumentLabel,
      keyPath,
      methodName,
      optionalPathLabel: path ? ` at path \`${path}\`` : "",
      value,
      ...path !== void 0 ? {path} : void 0
    });
    safeCaptureStackTrace(error, createSolanaJsonRpcIntegerOverflowError);
    return error;
  }

  var DEFAULT_RPC_CONFIG = {
    defaultCommitment: "confirmed",
    onIntegerOverflow(request, keyPath, value) {
      throw createSolanaJsonRpcIntegerOverflowError(request.methodName, keyPath, value);
    }
  };

  function getRpcTransportWithRequestCoalescing(transport) {
    return function makeCoalescedHttpRequest(request) {
      return transport(request);
    };
  }

  function getSolanaRpcPayloadDeduplicationKey(payload) {
    return isJsonRpcPayload(payload) ? src_default([payload.method, payload.params]) : void 0;
  }

  function normalizeHeaders2(headers) {
    const out = {};
    for(const headerName in headers) {
      out[headerName.toLowerCase()] = headers[headerName];
    }
    return out;
  }

  function createDefaultRpcTransport(config) {
    return pipe(
      createHttpTransportForSolanaRpc({
        ...config,
        headers: {
          ...false,
          ...config.headers ? normalizeHeaders2(config.headers) : void 0,
          ...{
            // Keep these headers lowercase so they will override any user-supplied headers above.
            "solana-client": `js/${"2.0.0"}`
          }
        }
      }),
      (transport) => getRpcTransportWithRequestCoalescing(transport, getSolanaRpcPayloadDeduplicationKey)
    );
  }

  function createSolanaRpc(clusterUrl, config) {
    return createSolanaRpcFromTransport(createDefaultRpcTransport({url: clusterUrl, ...config}));
  }

  function createSolanaRpcFromTransport(transport) {
    return createRpc({
      api: createSolanaRpcApi(DEFAULT_RPC_CONFIG),
      transport
    });
  }

  // ../rpc-types/dist/index.browser.mjs
  var memoizedBase58Encoder2;
  var memoizedBase58Decoder2;

  function getMemoizedBase58Encoder2() {
    if(!memoizedBase58Encoder2) memoizedBase58Encoder2 = getBase58Encoder();
    return memoizedBase58Encoder2;
  }

  function getMemoizedBase58Decoder2() {
    if(!memoizedBase58Decoder2) memoizedBase58Decoder2 = getBase58Decoder();
    return memoizedBase58Decoder2;
  }

  function isBlockhash(putativeBlockhash) {
    if(
      // Lowest value (32 bytes of zeroes)
      putativeBlockhash.length < 32 || // Highest value (32 bytes of 255)
      putativeBlockhash.length > 44
    ) {
      return false;
    }
    const base58Encoder2 = getMemoizedBase58Encoder2();
    const bytes = base58Encoder2.encode(putativeBlockhash);
    const numBytes = bytes.byteLength;
    if(numBytes !== 32) {
      return false;
    }
    return true;
  }

  function assertIsBlockhash(putativeBlockhash) {
    if(
      // Lowest value (32 bytes of zeroes)
      putativeBlockhash.length < 32 || // Highest value (32 bytes of 255)
      putativeBlockhash.length > 44
    ) {
      throw new SolanaError(SOLANA_ERROR__BLOCKHASH_STRING_LENGTH_OUT_OF_RANGE, {
        actualLength: putativeBlockhash.length
      });
    }
    const base58Encoder2 = getMemoizedBase58Encoder2();
    const bytes = base58Encoder2.encode(putativeBlockhash);
    const numBytes = bytes.byteLength;
    if(numBytes !== 32) {
      throw new SolanaError(SOLANA_ERROR__INVALID_BLOCKHASH_BYTE_LENGTH, {
        actualLength: numBytes
      });
    }
  }

  function blockhash(putativeBlockhash) {
    assertIsBlockhash(putativeBlockhash);
    return putativeBlockhash;
  }

  function getBlockhashEncoder() {
    return transformEncoder(
      fixEncoderSize(getMemoizedBase58Encoder2(), 32),
      (putativeBlockhash) => blockhash(putativeBlockhash)
    );
  }

  function getBlockhashDecoder() {
    return fixDecoderSize(getMemoizedBase58Decoder2(), 32);
  }

  function getBlockhashCodec() {
    return combineCodec(getBlockhashEncoder(), getBlockhashDecoder());
  }

  function getBlockhashComparator() {
    return new Intl.Collator("en", {
      caseFirst: "lower",
      ignorePunctuation: false,
      localeMatcher: "best fit",
      numeric: false,
      sensitivity: "variant",
      usage: "sort"
    }).compare;
  }

  function mainnet(putativeString) {
    return putativeString;
  }

  function devnet(putativeString) {
    return putativeString;
  }

  function testnet(putativeString) {
    return putativeString;
  }

  function getCommitmentScore(commitment) {
    switch(commitment) {
      case "finalized":
        return 2;
      case "confirmed":
        return 1;
      case "processed":
        return 0;
      default:
        throw new SolanaError(SOLANA_ERROR__INVARIANT_VIOLATION__SWITCH_MUST_BE_EXHAUSTIVE, {
          unexpectedValue: commitment
        });
    }
  }

  function commitmentComparator(a, b) {
    if(a === b) {
      return 0;
    }
    return getCommitmentScore(a) < getCommitmentScore(b) ? -1 : 1;
  }

  var maxU64Value = 18446744073709551615n;
  var memoizedU64Encoder;
  var memoizedU64Decoder;

  function getMemoizedU64Encoder() {
    if(!memoizedU64Encoder) memoizedU64Encoder = getU64Encoder();
    return memoizedU64Encoder;
  }

  function getMemoizedU64Decoder() {
    if(!memoizedU64Decoder) memoizedU64Decoder = getU64Decoder();
    return memoizedU64Decoder;
  }

  function isLamports(putativeLamports) {
    return putativeLamports >= 0 && putativeLamports <= maxU64Value;
  }

  function assertIsLamports(putativeLamports) {
    if(putativeLamports < 0 || putativeLamports > maxU64Value) {
      throw new SolanaError(SOLANA_ERROR__LAMPORTS_OUT_OF_RANGE);
    }
  }

  function lamports(putativeLamports) {
    assertIsLamports(putativeLamports);
    return putativeLamports;
  }

  function getDefaultLamportsEncoder() {
    return getLamportsEncoder(getMemoizedU64Encoder());
  }

  function getLamportsEncoder(innerEncoder) {
    return innerEncoder;
  }

  function getDefaultLamportsDecoder() {
    return getLamportsDecoder(getMemoizedU64Decoder());
  }

  function getLamportsDecoder(innerDecoder) {
    return transformDecoder(
      innerDecoder,
      (value) => lamports(typeof value === "bigint" ? value : BigInt(value))
    );
  }

  function getDefaultLamportsCodec() {
    return combineCodec(getDefaultLamportsEncoder(), getDefaultLamportsDecoder());
  }

  function getLamportsCodec(innerCodec) {
    return combineCodec(getLamportsEncoder(innerCodec), getLamportsDecoder(innerCodec));
  }

  function isStringifiedBigInt(putativeBigInt) {
    try {
      BigInt(putativeBigInt);
      return true;
    } catch {
      return false;
    }
  }

  function assertIsStringifiedBigInt(putativeBigInt) {
    try {
      BigInt(putativeBigInt);
    } catch {
      throw new SolanaError(SOLANA_ERROR__MALFORMED_BIGINT_STRING, {
        value: putativeBigInt
      });
    }
  }

  function stringifiedBigInt(putativeBigInt) {
    assertIsStringifiedBigInt(putativeBigInt);
    return putativeBigInt;
  }

  function isStringifiedNumber(putativeNumber) {
    return !Number.isNaN(Number(putativeNumber));
  }

  function assertIsStringifiedNumber(putativeNumber) {
    if(Number.isNaN(Number(putativeNumber))) {
      throw new SolanaError(SOLANA_ERROR__MALFORMED_NUMBER_STRING, {
        value: putativeNumber
      });
    }
  }

  function stringifiedNumber(putativeNumber) {
    assertIsStringifiedNumber(putativeNumber);
    return putativeNumber;
  }

  var maxI64Value = 9223372036854775807n;
  var minI64Value = -9223372036854775808n;

  function isUnixTimestamp(putativeTimestamp) {
    return putativeTimestamp >= minI64Value && putativeTimestamp <= maxI64Value;
  }

  function assertIsUnixTimestamp(putativeTimestamp) {
    if(putativeTimestamp < minI64Value || putativeTimestamp > maxI64Value) {
      throw new SolanaError(SOLANA_ERROR__TIMESTAMP_OUT_OF_RANGE, {
        value: putativeTimestamp
      });
    }
  }

  function unixTimestamp(putativeTimestamp) {
    assertIsUnixTimestamp(putativeTimestamp);
    return putativeTimestamp;
  }

  // ../transaction-messages/dist/index.browser.mjs
  function isTransactionMessageWithBlockhashLifetime(transaction) {
    const lifetimeConstraintShapeMatches = "lifetimeConstraint" in transaction && typeof transaction.lifetimeConstraint.blockhash === "string" && typeof transaction.lifetimeConstraint.lastValidBlockHeight === "bigint";
    if(!lifetimeConstraintShapeMatches) return false;
    try {
      assertIsBlockhash(transaction.lifetimeConstraint.blockhash);
      return true;
    } catch {
      return false;
    }
  }

  function assertIsTransactionMessageWithBlockhashLifetime(transaction) {
    if(!isTransactionMessageWithBlockhashLifetime(transaction)) {
      throw new SolanaError(SOLANA_ERROR__TRANSACTION__EXPECTED_BLOCKHASH_LIFETIME);
    }
  }

  function setTransactionMessageLifetimeUsingBlockhash(blockhashLifetimeConstraint, transaction) {
    if("lifetimeConstraint" in transaction && transaction.lifetimeConstraint.blockhash === blockhashLifetimeConstraint.blockhash && transaction.lifetimeConstraint.lastValidBlockHeight === blockhashLifetimeConstraint.lastValidBlockHeight) {
      return transaction;
    }
    const out = {
      ...transaction,
      lifetimeConstraint: Object.freeze(blockhashLifetimeConstraint)
    };
    Object.freeze(out);
    return out;
  }

  function assertValidBaseString2(alphabet4, testValue, givenValue = testValue) {
    if(!testValue.match(new RegExp(`^[${alphabet4}]*$`))) {
      throw new SolanaError(SOLANA_ERROR__CODECS__INVALID_STRING_FOR_BASE, {
        alphabet: alphabet4,
        base: alphabet4.length,
        value: givenValue
      });
    }
  }

  var getBaseXEncoder2 = (alphabet4) => {
    return createEncoder({
      getSizeFromValue: (value) => {
        const [leadingZeroes, tailChars] = partitionLeadingZeroes2(value, alphabet4[0]);
        if(!tailChars) return value.length;
        const base10Number = getBigIntFromBaseX2(tailChars, alphabet4);
        return leadingZeroes.length + Math.ceil(base10Number.toString(16).length / 2);
      },
      write(value, bytes, offset) {
        assertValidBaseString2(alphabet4, value);
        if(value === "") return offset;
        const [leadingZeroes, tailChars] = partitionLeadingZeroes2(value, alphabet4[0]);
        if(!tailChars) {
          bytes.set(new Uint8Array(leadingZeroes.length).fill(0), offset);
          return offset + leadingZeroes.length;
        }
        let base10Number = getBigIntFromBaseX2(tailChars, alphabet4);
        const tailBytes = [];
        while(base10Number > 0n) {
          tailBytes.unshift(Number(base10Number % 256n));
          base10Number /= 256n;
        }
        const bytesToAdd = [...Array(leadingZeroes.length).fill(0), ...tailBytes];
        bytes.set(bytesToAdd, offset);
        return offset + bytesToAdd.length;
      }
    });
  };
  var getBaseXDecoder2 = (alphabet4) => {
    return createDecoder({
      read(rawBytes, offset) {
        const bytes = offset === 0 ? rawBytes : rawBytes.slice(offset);
        if(bytes.length === 0) return ["", 0];
        let trailIndex = bytes.findIndex((n) => n !== 0);
        trailIndex = trailIndex === -1 ? bytes.length : trailIndex;
        const leadingZeroes = alphabet4[0].repeat(trailIndex);
        if(trailIndex === bytes.length) return [leadingZeroes, rawBytes.length];
        const base10Number = bytes.slice(trailIndex).reduce((sum, byte) => sum * 256n + BigInt(byte), 0n);
        const tailChars = getBaseXFromBigInt2(base10Number, alphabet4);
        return [leadingZeroes + tailChars, rawBytes.length];
      }
    });
  };

  function partitionLeadingZeroes2(value, zeroCharacter) {
    const [leadingZeros, tailChars] = value.split(new RegExp(`((?!${zeroCharacter}).*)`));
    return [leadingZeros, tailChars];
  }

  function getBigIntFromBaseX2(value, alphabet4) {
    const base = BigInt(alphabet4.length);
    let sum = 0n;
    for(const char of value) {
      sum *= base;
      sum += BigInt(alphabet4.indexOf(char));
    }
    return sum;
  }

  function getBaseXFromBigInt2(value, alphabet4) {
    const base = BigInt(alphabet4.length);
    const tailChars = [];
    while(value > 0n) {
      tailChars.unshift(alphabet4[Number(value % base)]);
      value /= base;
    }
    return tailChars.join("");
  }

  var alphabet22 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  var getBase58Encoder2 = () => getBaseXEncoder2(alphabet22);
  var getBase58Decoder2 = () => getBaseXDecoder2(alphabet22);
  var memoizedAddressTableLookupEncoder;

  function getAddressTableLookupEncoder() {
    if(!memoizedAddressTableLookupEncoder) {
      memoizedAddressTableLookupEncoder = getStructEncoder([
        ["lookupTableAddress", getAddressEncoder()],
        [
          "writableIndices",
          getArrayEncoder(getU8Encoder(), {size: getShortU16Encoder()})
        ],
        [
          "readableIndices",
          getArrayEncoder(getU8Encoder(), {size: getShortU16Encoder()})
        ]
      ]);
    }
    return memoizedAddressTableLookupEncoder;
  }

  var memoizedAddressTableLookupDecoder;

  function getAddressTableLookupDecoder() {
    if(!memoizedAddressTableLookupDecoder) {
      memoizedAddressTableLookupDecoder = getStructDecoder([
        ["lookupTableAddress", getAddressDecoder()],
        ["writableIndices", getArrayDecoder(getU8Decoder(), {size: getShortU16Decoder()})],
        ["readableIndices", getArrayDecoder(getU8Decoder(), {size: getShortU16Decoder()})]
      ]);
    }
    return memoizedAddressTableLookupDecoder;
  }

  var memoizedU8Encoder;

  function getMemoizedU8Encoder() {
    if(!memoizedU8Encoder) memoizedU8Encoder = getU8Encoder();
    return memoizedU8Encoder;
  }

  var memoizedU8Decoder;

  function getMemoizedU8Decoder() {
    if(!memoizedU8Decoder) memoizedU8Decoder = getU8Decoder();
    return memoizedU8Decoder;
  }

  function getMessageHeaderEncoder() {
    return getStructEncoder([
      ["numSignerAccounts", getMemoizedU8Encoder()],
      ["numReadonlySignerAccounts", getMemoizedU8Encoder()],
      ["numReadonlyNonSignerAccounts", getMemoizedU8Encoder()]
    ]);
  }

  function getMessageHeaderDecoder() {
    return getStructDecoder([
      ["numSignerAccounts", getMemoizedU8Decoder()],
      ["numReadonlySignerAccounts", getMemoizedU8Decoder()],
      ["numReadonlyNonSignerAccounts", getMemoizedU8Decoder()]
    ]);
  }

  var memoizedGetInstructionEncoder;

  function getInstructionEncoder() {
    if(!memoizedGetInstructionEncoder) {
      memoizedGetInstructionEncoder = transformEncoder(
        getStructEncoder([
          ["programAddressIndex", getU8Encoder()],
          ["accountIndices", getArrayEncoder(getU8Encoder(), {size: getShortU16Encoder()})],
          ["data", addEncoderSizePrefix(getBytesEncoder(), getShortU16Encoder())]
        ]),
        // Convert an instruction to have all fields defined
        (instruction) => {
          var _a, _b;
          if(instruction.accountIndices !== void 0 && instruction.data !== void 0) {
            return instruction;
          }
          return {
            ...instruction,
            accountIndices: (_a = instruction.accountIndices) != null ? _a : [],
            data: (_b = instruction.data) != null ? _b : new Uint8Array(0)
          };
        }
      );
    }
    return memoizedGetInstructionEncoder;
  }

  var memoizedGetInstructionDecoder;

  function getInstructionDecoder() {
    if(!memoizedGetInstructionDecoder) {
      memoizedGetInstructionDecoder = transformDecoder(
        getStructDecoder([
          ["programAddressIndex", getU8Decoder()],
          ["accountIndices", getArrayDecoder(getU8Decoder(), {size: getShortU16Decoder()})],
          [
            "data",
            addDecoderSizePrefix(getBytesDecoder(), getShortU16Decoder())
          ]
        ]),
        // Convert an instruction to exclude optional fields if they are empty
        (instruction) => {
          if(instruction.accountIndices.length && instruction.data.byteLength) {
            return instruction;
          }
          const {accountIndices, data, ...rest} = instruction;
          return {
            ...rest,
            ...accountIndices.length ? {accountIndices} : null,
            ...data.byteLength ? {data} : null
          };
        }
      );
    }
    return memoizedGetInstructionDecoder;
  }

  var VERSION_FLAG_MASK = 128;

  function getTransactionVersionEncoder() {
    return createEncoder({
      getSizeFromValue: (value) => value === "legacy" ? 0 : 1,
      maxSize: 1,
      write: (value, bytes, offset) => {
        if(value === "legacy") {
          return offset;
        }
        if(value < 0 || value > 127) {
          throw new SolanaError(SOLANA_ERROR__TRANSACTION__VERSION_NUMBER_OUT_OF_RANGE, {
            actualVersion: value
          });
        }
        bytes.set([value | VERSION_FLAG_MASK], offset);
        return offset + 1;
      }
    });
  }

  function getTransactionVersionDecoder() {
    return createDecoder({
      maxSize: 1,
      read: (bytes, offset) => {
        const firstByte = bytes[offset];
        if((firstByte & VERSION_FLAG_MASK) === 0) {
          return ["legacy", offset];
        }
        else {
          const version = firstByte ^ VERSION_FLAG_MASK;
          return [version, offset + 1];
        }
      }
    });
  }

  function getTransactionVersionCodec() {
    return combineCodec(getTransactionVersionEncoder(), getTransactionVersionDecoder());
  }

  function getCompiledMessageLegacyEncoder() {
    return getStructEncoder(getPreludeStructEncoderTuple());
  }

  function getCompiledMessageVersionedEncoder() {
    return transformEncoder(
      getStructEncoder([
        ...getPreludeStructEncoderTuple(),
        ["addressTableLookups", getAddressTableLookupArrayEncoder()]
      ]),
      (value) => {
        var _a;
        if(value.version === "legacy") {
          return value;
        }
        return {
          ...value,
          addressTableLookups: (_a = value.addressTableLookups) != null ? _a : []
        };
      }
    );
  }

  function getPreludeStructEncoderTuple() {
    return [
      ["version", getTransactionVersionEncoder()],
      ["header", getMessageHeaderEncoder()],
      ["staticAccounts", getArrayEncoder(getAddressEncoder(), {size: getShortU16Encoder()})],
      ["lifetimeToken", fixEncoderSize(getBase58Encoder2(), 32)],
      ["instructions", getArrayEncoder(getInstructionEncoder(), {size: getShortU16Encoder()})]
    ];
  }

  function getPreludeStructDecoderTuple() {
    return [
      ["version", getTransactionVersionDecoder()],
      ["header", getMessageHeaderDecoder()],
      ["staticAccounts", getArrayDecoder(getAddressDecoder(), {size: getShortU16Decoder()})],
      ["lifetimeToken", fixDecoderSize(getBase58Decoder2(), 32)],
      ["instructions", getArrayDecoder(getInstructionDecoder(), {size: getShortU16Decoder()})],
      ["addressTableLookups", getAddressTableLookupArrayDecoder()]
    ];
  }

  function getAddressTableLookupArrayEncoder() {
    return getArrayEncoder(getAddressTableLookupEncoder(), {size: getShortU16Encoder()});
  }

  function getAddressTableLookupArrayDecoder() {
    return getArrayDecoder(getAddressTableLookupDecoder(), {size: getShortU16Decoder()});
  }

  function getCompiledTransactionMessageEncoder() {
    return createEncoder({
      getSizeFromValue: (compiledMessage) => {
        if(compiledMessage.version === "legacy") {
          return getCompiledMessageLegacyEncoder().getSizeFromValue(compiledMessage);
        }
        else {
          return getCompiledMessageVersionedEncoder().getSizeFromValue(compiledMessage);
        }
      },
      write: (compiledMessage, bytes, offset) => {
        if(compiledMessage.version === "legacy") {
          return getCompiledMessageLegacyEncoder().write(compiledMessage, bytes, offset);
        }
        else {
          return getCompiledMessageVersionedEncoder().write(compiledMessage, bytes, offset);
        }
      }
    });
  }

  function getCompiledTransactionMessageDecoder() {
    return transformDecoder(
      getStructDecoder(getPreludeStructDecoderTuple()),
      ({addressTableLookups, ...restOfMessage}) => {
        if(restOfMessage.version === "legacy" || !(addressTableLookups == null ? void 0 : addressTableLookups.length)) {
          return restOfMessage;
        }
        return {...restOfMessage, addressTableLookups};
      }
    );
  }

  function getCompiledTransactionMessageCodec() {
    return combineCodec(getCompiledTransactionMessageEncoder(), getCompiledTransactionMessageDecoder());
  }

  function upsert(addressMap, address2, update) {
    var _a;
    addressMap[address2] = update((_a = addressMap[address2]) != null ? _a : {role: AccountRole.READONLY});
  }

  var TYPE2 = Symbol("AddressMapTypeProperty");

  function getAddressMapFromInstructions(feePayer, instructions) {
    const addressMap = {
      [feePayer]: {[TYPE2]: 0, role: AccountRole.WRITABLE_SIGNER}
    };
    const addressesOfInvokedPrograms = /* @__PURE__ */ new Set();
    for(const instruction of instructions) {
      upsert(addressMap, instruction.programAddress, (entry) => {
        addressesOfInvokedPrograms.add(instruction.programAddress);
        if(TYPE2 in entry) {
          if(isWritableRole(entry.role)) {
            switch(entry[TYPE2]) {
              case 0:
                throw new SolanaError(SOLANA_ERROR__TRANSACTION__INVOKED_PROGRAMS_CANNOT_PAY_FEES, {
                  programAddress: instruction.programAddress
                });
              default:
                throw new SolanaError(SOLANA_ERROR__TRANSACTION__INVOKED_PROGRAMS_MUST_NOT_BE_WRITABLE, {
                  programAddress: instruction.programAddress
                });
            }
          }
          if(entry[TYPE2] === 2) {
            return entry;
          }
        }
        return {[TYPE2]: 2, role: AccountRole.READONLY};
      });
      let addressComparator;
      if(!instruction.accounts) {
        continue;
      }
      for(const account of instruction.accounts) {
        upsert(addressMap, account.address, (entry) => {
          const {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            address: _,
            ...accountMeta
          } = account;
          if(TYPE2 in entry) {
            switch(entry[TYPE2]) {
              case 0:
                return entry;
              case 1: {
                const nextRole = mergeRoles(entry.role, accountMeta.role);
                if("lookupTableAddress" in accountMeta) {
                  const shouldReplaceEntry = (
                    // Consider using the new LOOKUP_TABLE if its address is different...
                    entry.lookupTableAddress !== accountMeta.lookupTableAddress && // ...and sorts before the existing one.
                    (addressComparator || (addressComparator = getAddressComparator()))(
                      accountMeta.lookupTableAddress,
                      entry.lookupTableAddress
                    ) < 0
                  );
                  if(shouldReplaceEntry) {
                    return {
                      [TYPE2]: 1,
                      ...accountMeta,
                      role: nextRole
                    };
                  }
                }
                else if(isSignerRole(accountMeta.role)) {
                  return {
                    [TYPE2]: 2,
                    role: nextRole
                  };
                }
                if(entry.role !== nextRole) {
                  return {
                    ...entry,
                    role: nextRole
                  };
                }
                else {
                  return entry;
                }
              }
              case 2: {
                const nextRole = mergeRoles(entry.role, accountMeta.role);
                if(
                  // Check to see if this address represents a program that is invoked
                  // in this transaction.
                  addressesOfInvokedPrograms.has(account.address)
                ) {
                  if(isWritableRole(accountMeta.role)) {
                    throw new SolanaError(
                      SOLANA_ERROR__TRANSACTION__INVOKED_PROGRAMS_MUST_NOT_BE_WRITABLE,
                      {
                        programAddress: account.address
                      }
                    );
                  }
                  if(entry.role !== nextRole) {
                    return {
                      ...entry,
                      role: nextRole
                    };
                  }
                  else {
                    return entry;
                  }
                }
                else if("lookupTableAddress" in accountMeta && // Static accounts can be 'upgraded' to lookup table accounts as
                  // long as they are not require to sign the transaction.
                  !isSignerRole(entry.role)) {
                  return {
                    ...accountMeta,
                    [TYPE2]: 1,
                    role: nextRole
                  };
                }
                else {
                  if(entry.role !== nextRole) {
                    return {
                      ...entry,
                      role: nextRole
                    };
                  }
                  else {
                    return entry;
                  }
                }
              }
            }
          }
          if("lookupTableAddress" in accountMeta) {
            return {
              ...accountMeta,
              [TYPE2]: 1
              /* LOOKUP_TABLE */
            };
          }
          else {
            return {
              ...accountMeta,
              [TYPE2]: 2
              /* STATIC */
            };
          }
        });
      }
    }
    return addressMap;
  }

  function getOrderedAccountsFromAddressMap(addressMap) {
    let addressComparator;
    const orderedAccounts = Object.entries(addressMap).sort(([leftAddress, leftEntry], [rightAddress, rightEntry]) => {
      if(leftEntry[TYPE2] !== rightEntry[TYPE2]) {
        if(leftEntry[TYPE2] === 0) {
          return -1;
        }
        else if(rightEntry[TYPE2] === 0) {
          return 1;
        }
        else if(leftEntry[TYPE2] === 2) {
          return -1;
        }
        else if(rightEntry[TYPE2] === 2) {
          return 1;
        }
      }
      const leftIsSigner = isSignerRole(leftEntry.role);
      if(leftIsSigner !== isSignerRole(rightEntry.role)) {
        return leftIsSigner ? -1 : 1;
      }
      const leftIsWritable = isWritableRole(leftEntry.role);
      if(leftIsWritable !== isWritableRole(rightEntry.role)) {
        return leftIsWritable ? -1 : 1;
      }
      addressComparator || (addressComparator = getAddressComparator());
      if(leftEntry[TYPE2] === 1 && rightEntry[TYPE2] === 1 && leftEntry.lookupTableAddress !== rightEntry.lookupTableAddress) {
        return addressComparator(leftEntry.lookupTableAddress, rightEntry.lookupTableAddress);
      }
      else {
        return addressComparator(leftAddress, rightAddress);
      }
    }).map(([address2, addressMeta]) => ({
      address: address2,
      ...addressMeta
    }));
    return orderedAccounts;
  }

  function getCompiledAddressTableLookups(orderedAccounts) {
    var _a;
    const index = {};
    for(const account of orderedAccounts) {
      if(!("lookupTableAddress" in account)) {
        continue;
      }
      const entry = index[_a = account.lookupTableAddress] || (index[_a] = {
        readableIndices: [],
        writableIndices: []
      });
      if(account.role === AccountRole.WRITABLE) {
        entry.writableIndices.push(account.addressIndex);
      }
      else {
        entry.readableIndices.push(account.addressIndex);
      }
    }
    return Object.keys(index).sort(getAddressComparator()).map((lookupTableAddress) => ({
      lookupTableAddress,
      ...index[lookupTableAddress]
    }));
  }

  function getCompiledMessageHeader(orderedAccounts) {
    let numReadonlyNonSignerAccounts = 0;
    let numReadonlySignerAccounts = 0;
    let numSignerAccounts = 0;
    for(const account of orderedAccounts) {
      if("lookupTableAddress" in account) {
        break;
      }
      const accountIsWritable = isWritableRole(account.role);
      if(isSignerRole(account.role)) {
        numSignerAccounts++;
        if(!accountIsWritable) {
          numReadonlySignerAccounts++;
        }
      }
      else if(!accountIsWritable) {
        numReadonlyNonSignerAccounts++;
      }
    }
    return {
      numReadonlyNonSignerAccounts,
      numReadonlySignerAccounts,
      numSignerAccounts
    };
  }

  function getAccountIndex(orderedAccounts) {
    const out = {};
    for(const [index, account] of orderedAccounts.entries()) {
      out[account.address] = index;
    }
    return out;
  }

  function getCompiledInstructions(instructions, orderedAccounts) {
    const accountIndex = getAccountIndex(orderedAccounts);
    return instructions.map(({accounts, data, programAddress}) => {
      return {
        programAddressIndex: accountIndex[programAddress],
        ...accounts ? {accountIndices: accounts.map(({address: address2}) => accountIndex[address2])} : null,
        ...data ? {data} : null
      };
    });
  }

  function getCompiledLifetimeToken(lifetimeConstraint) {
    if("nonce" in lifetimeConstraint) {
      return lifetimeConstraint.nonce;
    }
    return lifetimeConstraint.blockhash;
  }

  function getCompiledStaticAccounts(orderedAccounts) {
    const firstLookupTableAccountIndex = orderedAccounts.findIndex((account) => "lookupTableAddress" in account);
    const orderedStaticAccounts = firstLookupTableAccountIndex === -1 ? orderedAccounts : orderedAccounts.slice(0, firstLookupTableAccountIndex);
    return orderedStaticAccounts.map(({address: address2}) => address2);
  }

  function compileTransactionMessage(transaction) {
    const addressMap = getAddressMapFromInstructions(transaction.feePayer.address, transaction.instructions);
    const orderedAccounts = getOrderedAccountsFromAddressMap(addressMap);
    return {
      ...transaction.version !== "legacy" ? {addressTableLookups: getCompiledAddressTableLookups(orderedAccounts)} : null,
      header: getCompiledMessageHeader(orderedAccounts),
      instructions: getCompiledInstructions(transaction.instructions, orderedAccounts),
      lifetimeToken: getCompiledLifetimeToken(transaction.lifetimeConstraint),
      staticAccounts: getCompiledStaticAccounts(orderedAccounts),
      version: transaction.version
    };
  }

  function findAddressInLookupTables(address2, role, addressesByLookupTableAddress) {
    for(const [lookupTableAddress, addresses] of Object.entries(addressesByLookupTableAddress)) {
      for(let i = 0; i < addresses.length; i++) {
        if(address2 === addresses[i]) {
          return {
            address: address2,
            addressIndex: i,
            lookupTableAddress,
            role
          };
        }
      }
    }
  }

  function compressTransactionMessageUsingAddressLookupTables(transactionMessage, addressesByLookupTableAddress) {
    const lookupTableAddresses = new Set(Object.values(addressesByLookupTableAddress).flatMap((a) => a));
    const newInstructions = [];
    let updatedAnyInstructions = false;
    for(const instruction of transactionMessage.instructions) {
      if(!instruction.accounts) {
        newInstructions.push(instruction);
        continue;
      }
      const newAccounts = [];
      let updatedAnyAccounts = false;
      for(const account of instruction.accounts) {
        if("lookupTableAddress" in account || !lookupTableAddresses.has(account.address) || isSignerRole(account.role)) {
          newAccounts.push(account);
          continue;
        }
        const lookupMetaAccount = findAddressInLookupTables(
          account.address,
          account.role,
          addressesByLookupTableAddress
        );
        newAccounts.push(Object.freeze(lookupMetaAccount));
        updatedAnyAccounts = true;
        updatedAnyInstructions = true;
      }
      newInstructions.push(
        Object.freeze(updatedAnyAccounts ? {...instruction, accounts: newAccounts} : instruction)
      );
    }
    return Object.freeze(
      updatedAnyInstructions ? {...transactionMessage, instructions: newInstructions} : transactionMessage
    );
  }

  function createTransactionMessage({
    version
  }) {
    return Object.freeze({
      instructions: Object.freeze([]),
      version
    });
  }

  var RECENT_BLOCKHASHES_SYSVAR_ADDRESS = "SysvarRecentB1ockHashes11111111111111111111";
  var SYSTEM_PROGRAM_ADDRESS = "11111111111111111111111111111111";

  function assertIsDurableNonceTransactionMessage(transaction) {
    if(!isDurableNonceTransaction(transaction)) {
      throw new SolanaError(SOLANA_ERROR__TRANSACTION__EXPECTED_NONCE_LIFETIME);
    }
  }

  function createAdvanceNonceAccountInstruction(nonceAccountAddress, nonceAuthorityAddress) {
    return {
      accounts: [
        {address: nonceAccountAddress, role: AccountRole.WRITABLE},
        {
          address: RECENT_BLOCKHASHES_SYSVAR_ADDRESS,
          role: AccountRole.READONLY
        },
        {address: nonceAuthorityAddress, role: AccountRole.READONLY_SIGNER}
      ],
      data: new Uint8Array([4, 0, 0, 0]),
      programAddress: SYSTEM_PROGRAM_ADDRESS
    };
  }

  function isAdvanceNonceAccountInstruction(instruction) {
    var _a;
    return instruction.programAddress === SYSTEM_PROGRAM_ADDRESS && // Test for `AdvanceNonceAccount` instruction data
      instruction.data != null && isAdvanceNonceAccountInstructionData(instruction.data) && // Test for exactly 3 accounts
      ((_a = instruction.accounts) == null ? void 0 : _a.length) === 3 && // First account is nonce account address
      instruction.accounts[0].address != null && instruction.accounts[0].role === AccountRole.WRITABLE && // Second account is recent blockhashes sysvar
      instruction.accounts[1].address === RECENT_BLOCKHASHES_SYSVAR_ADDRESS && instruction.accounts[1].role === AccountRole.READONLY && // Third account is nonce authority account
      instruction.accounts[2].address != null && isSignerRole(instruction.accounts[2].role);
  }

  function isAdvanceNonceAccountInstructionData(data) {
    return data.byteLength === 4 && data[0] === 4 && data[1] === 0 && data[2] === 0 && data[3] === 0;
  }

  function isDurableNonceTransaction(transaction) {
    return "lifetimeConstraint" in transaction && typeof transaction.lifetimeConstraint.nonce === "string" && transaction.instructions[0] != null && isAdvanceNonceAccountInstruction(transaction.instructions[0]);
  }

  function isAdvanceNonceAccountInstructionForNonce(instruction, nonceAccountAddress, nonceAuthorityAddress) {
    return instruction.accounts[0].address === nonceAccountAddress && instruction.accounts[2].address === nonceAuthorityAddress;
  }

  function setTransactionMessageLifetimeUsingDurableNonce({
    nonce,
    nonceAccountAddress,
    nonceAuthorityAddress
  }, transaction) {
    let newInstructions;
    const firstInstruction = transaction.instructions[0];
    if(firstInstruction && isAdvanceNonceAccountInstruction(firstInstruction)) {
      if(isAdvanceNonceAccountInstructionForNonce(firstInstruction, nonceAccountAddress, nonceAuthorityAddress)) {
        if(isDurableNonceTransaction(transaction) && transaction.lifetimeConstraint.nonce === nonce) {
          return transaction;
        }
        else {
          newInstructions = [firstInstruction, ...transaction.instructions.slice(1)];
        }
      }
      else {
        newInstructions = [
          Object.freeze(createAdvanceNonceAccountInstruction(nonceAccountAddress, nonceAuthorityAddress)),
          ...transaction.instructions.slice(1)
        ];
      }
    }
    else {
      newInstructions = [
        Object.freeze(createAdvanceNonceAccountInstruction(nonceAccountAddress, nonceAuthorityAddress)),
        ...transaction.instructions
      ];
    }
    return Object.freeze({
      ...transaction,
      instructions: Object.freeze(newInstructions),
      lifetimeConstraint: Object.freeze({
        nonce
      })
    });
  }

  function setTransactionMessageFeePayer(feePayer, transactionMessage) {
    var _a;
    if("feePayer" in transactionMessage && feePayer === ((_a = transactionMessage.feePayer) == null ? void 0 : _a.address) && isAddressOnlyFeePayer(transactionMessage.feePayer)) {
      return transactionMessage;
    }
    const out = {
      ...transactionMessage,
      feePayer: Object.freeze({address: feePayer})
    };
    Object.freeze(out);
    return out;
  }

  function isAddressOnlyFeePayer(feePayer) {
    return !!feePayer && "address" in feePayer && typeof feePayer.address === "string" && Object.keys(feePayer).length === 1;
  }

  function appendTransactionMessageInstruction(instruction, transaction) {
    return appendTransactionMessageInstructions([instruction], transaction);
  }

  function appendTransactionMessageInstructions(instructions, transaction) {
    return Object.freeze({
      ...transaction,
      instructions: Object.freeze([...transaction.instructions, ...instructions])
    });
  }

  function prependTransactionMessageInstruction(instruction, transaction) {
    return prependTransactionMessageInstructions([instruction], transaction);
  }

  function prependTransactionMessageInstructions(instructions, transaction) {
    return Object.freeze({
      ...transaction,
      instructions: Object.freeze([...instructions, ...transaction.instructions])
    });
  }

  function getAccountMetas(message) {
    const {header} = message;
    const numWritableSignerAccounts = header.numSignerAccounts - header.numReadonlySignerAccounts;
    const numWritableNonSignerAccounts = message.staticAccounts.length - header.numSignerAccounts - header.numReadonlyNonSignerAccounts;
    const accountMetas = [];
    let accountIndex = 0;
    for(let i = 0; i < numWritableSignerAccounts; i++) {
      accountMetas.push({
        address: message.staticAccounts[accountIndex],
        role: AccountRole.WRITABLE_SIGNER
      });
      accountIndex++;
    }
    for(let i = 0; i < header.numReadonlySignerAccounts; i++) {
      accountMetas.push({
        address: message.staticAccounts[accountIndex],
        role: AccountRole.READONLY_SIGNER
      });
      accountIndex++;
    }
    for(let i = 0; i < numWritableNonSignerAccounts; i++) {
      accountMetas.push({
        address: message.staticAccounts[accountIndex],
        role: AccountRole.WRITABLE
      });
      accountIndex++;
    }
    for(let i = 0; i < header.numReadonlyNonSignerAccounts; i++) {
      accountMetas.push({
        address: message.staticAccounts[accountIndex],
        role: AccountRole.READONLY
      });
      accountIndex++;
    }
    return accountMetas;
  }

  function getAddressLookupMetas(compiledAddressTableLookups, addressesByLookupTableAddress) {
    const compiledAddressTableLookupAddresses = compiledAddressTableLookups.map((l) => l.lookupTableAddress);
    const missing = compiledAddressTableLookupAddresses.filter((a) => addressesByLookupTableAddress[a] === void 0);
    if(missing.length > 0) {
      throw new SolanaError(SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_ADDRESS_LOOKUP_TABLE_CONTENTS_MISSING, {
        lookupTableAddresses: missing
      });
    }
    const readOnlyMetas = [];
    const writableMetas = [];
    for(const lookup of compiledAddressTableLookups) {
      const addresses = addressesByLookupTableAddress[lookup.lookupTableAddress];
      const highestIndex = Math.max(...lookup.readableIndices, ...lookup.writableIndices);
      if(highestIndex >= addresses.length) {
        throw new SolanaError(
          SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_ADDRESS_LOOKUP_TABLE_INDEX_OUT_OF_RANGE,
          {
            highestKnownIndex: addresses.length - 1,
            highestRequestedIndex: highestIndex,
            lookupTableAddress: lookup.lookupTableAddress
          }
        );
      }
      const readOnlyForLookup = lookup.readableIndices.map((r) => ({
        address: addresses[r],
        addressIndex: r,
        lookupTableAddress: lookup.lookupTableAddress,
        role: AccountRole.READONLY
      }));
      readOnlyMetas.push(...readOnlyForLookup);
      const writableForLookup = lookup.writableIndices.map((w) => ({
        address: addresses[w],
        addressIndex: w,
        lookupTableAddress: lookup.lookupTableAddress,
        role: AccountRole.WRITABLE
      }));
      writableMetas.push(...writableForLookup);
    }
    return [...writableMetas, ...readOnlyMetas];
  }

  function convertInstruction(instruction, accountMetas) {
    var _a, _b;
    const programAddress = (_a = accountMetas[instruction.programAddressIndex]) == null ? void 0 : _a.address;
    if(!programAddress) {
      throw new SolanaError(SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_INSTRUCTION_PROGRAM_ADDRESS_NOT_FOUND, {
        index: instruction.programAddressIndex
      });
    }
    const accounts = (_b = instruction.accountIndices) == null ? void 0 : _b.map((accountIndex) => accountMetas[accountIndex]);
    const {data} = instruction;
    return Object.freeze({
      programAddress,
      ...accounts && accounts.length ? {accounts: Object.freeze(accounts)} : {},
      ...data && data.length ? {data} : {}
    });
  }

  function getLifetimeConstraint(messageLifetimeToken, firstInstruction, lastValidBlockHeight) {
    if(!firstInstruction || !isAdvanceNonceAccountInstruction(firstInstruction)) {
      return {
        blockhash: messageLifetimeToken,
        lastValidBlockHeight: lastValidBlockHeight != null ? lastValidBlockHeight : 2n ** 64n - 1n
        // U64 MAX
      };
    }
    else {
      const nonceAccountAddress = firstInstruction.accounts[0].address;
      assertIsAddress(nonceAccountAddress);
      const nonceAuthorityAddress = firstInstruction.accounts[2].address;
      assertIsAddress(nonceAuthorityAddress);
      return {
        nonce: messageLifetimeToken,
        nonceAccountAddress,
        nonceAuthorityAddress
      };
    }
  }

  function decompileTransactionMessage(compiledTransactionMessage, config) {
    var _a;
    const feePayer = compiledTransactionMessage.staticAccounts[0];
    if(!feePayer) {
      throw new SolanaError(SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_FEE_PAYER_MISSING);
    }
    const accountMetas = getAccountMetas(compiledTransactionMessage);
    const accountLookupMetas = "addressTableLookups" in compiledTransactionMessage && compiledTransactionMessage.addressTableLookups !== void 0 && compiledTransactionMessage.addressTableLookups.length > 0 ? getAddressLookupMetas(
      compiledTransactionMessage.addressTableLookups,
      (_a = config == null ? void 0 : config.addressesByLookupTableAddress) != null ? _a : {}
    ) : [];
    const transactionMetas = [...accountMetas, ...accountLookupMetas];
    const instructions = compiledTransactionMessage.instructions.map(
      (compiledInstruction) => convertInstruction(compiledInstruction, transactionMetas)
    );
    const firstInstruction = instructions[0];
    const lifetimeConstraint = getLifetimeConstraint(
      compiledTransactionMessage.lifetimeToken,
      firstInstruction,
      config == null ? void 0 : config.lastValidBlockHeight
    );
    return pipe(
      createTransactionMessage({version: compiledTransactionMessage.version}),
      (tx) => setTransactionMessageFeePayer(feePayer, tx),
      (tx) => instructions.reduce((acc, instruction) => {
        return appendTransactionMessageInstruction(instruction, acc);
      }, tx),
      (tx) => "blockhash" in lifetimeConstraint ? setTransactionMessageLifetimeUsingBlockhash(lifetimeConstraint, tx) : setTransactionMessageLifetimeUsingDurableNonce(lifetimeConstraint, tx)
    );
  }

  // ../transactions/dist/index.browser.mjs
  function getSignaturesToEncode(signaturesMap) {
    const signatures = Object.values(signaturesMap);
    if(signatures.length === 0) {
      throw new SolanaError(SOLANA_ERROR__TRANSACTION__CANNOT_ENCODE_WITH_EMPTY_SIGNATURES);
    }
    return signatures.map((signature2) => {
      if(!signature2) {
        return new Uint8Array(64).fill(0);
      }
      return signature2;
    });
  }

  function getSignaturesEncoder() {
    return transformEncoder(
      getArrayEncoder(fixEncoderSize(getBytesEncoder(), 64), {size: getShortU16Encoder()}),
      getSignaturesToEncode
    );
  }

  function getTransactionEncoder() {
    return getStructEncoder([
      ["signatures", getSignaturesEncoder()],
      ["messageBytes", getBytesEncoder()]
    ]);
  }

  function getTransactionDecoder() {
    return transformDecoder(
      getStructDecoder([
        ["signatures", getArrayDecoder(fixDecoderSize(getBytesDecoder(), 64), {size: getShortU16Decoder()})],
        ["messageBytes", getBytesDecoder()]
      ]),
      decodePartiallyDecodedTransaction
    );
  }

  function getTransactionCodec() {
    return combineCodec(getTransactionEncoder(), getTransactionDecoder());
  }

  function decodePartiallyDecodedTransaction(transaction) {
    const {messageBytes, signatures} = transaction;
    const signerAddressesDecoder = getTupleDecoder([
      // read transaction version
      getTransactionVersionDecoder(),
      // read first byte of header, `numSignerAccounts`
      // padRight to skip the next 2 bytes, `numReadOnlySignedAccounts` and `numReadOnlyUnsignedAccounts` which we don't need
      padRightDecoder(getU8Decoder(), 2),
      // read static addresses
      getArrayDecoder(getAddressDecoder(), {size: getShortU16Decoder()})
    ]);
    const [_txVersion, numRequiredSignatures, staticAddresses] = signerAddressesDecoder.decode(messageBytes);
    const signerAddresses = staticAddresses.slice(0, numRequiredSignatures);
    if(signerAddresses.length !== signatures.length) {
      throw new SolanaError(SOLANA_ERROR__TRANSACTION__MESSAGE_SIGNATURES_MISMATCH, {
        numRequiredSignatures,
        signaturesLength: signatures.length,
        signerAddresses
      });
    }
    const signaturesMap = {};
    signerAddresses.forEach((address2, index) => {
      const signatureForAddress = signatures[index];
      if(signatureForAddress.every((b) => b === 0)) {
        signaturesMap[address2] = null;
      }
      else {
        signaturesMap[address2] = signatureForAddress;
      }
    });
    return {
      messageBytes,
      signatures: Object.freeze(signaturesMap)
    };
  }

  function compileTransaction(transactionMessage) {
    const compiledMessage = compileTransactionMessage(transactionMessage);
    const messageBytes = getCompiledTransactionMessageEncoder().encode(compiledMessage);
    const transactionSigners = compiledMessage.staticAccounts.slice(0, compiledMessage.header.numSignerAccounts);
    const signatures = {};
    for(const signerAddress of transactionSigners) {
      signatures[signerAddress] = null;
    }
    let lifetimeConstraint;
    if(isTransactionMessageWithBlockhashLifetime(transactionMessage)) {
      lifetimeConstraint = {
        blockhash: transactionMessage.lifetimeConstraint.blockhash,
        lastValidBlockHeight: transactionMessage.lifetimeConstraint.lastValidBlockHeight
      };
    }
    else {
      lifetimeConstraint = {
        nonce: transactionMessage.lifetimeConstraint.nonce,
        nonceAccountAddress: transactionMessage.instructions[0].accounts[0].address
      };
    }
    const transaction = {
      lifetimeConstraint,
      messageBytes,
      signatures: Object.freeze(signatures)
    };
    return Object.freeze(transaction);
  }

  var base58Decoder;

  function getSignatureFromTransaction(transaction) {
    if(!base58Decoder) base58Decoder = getBase58Decoder();
    const signatureBytes = Object.values(transaction.signatures)[0];
    if(!signatureBytes) {
      throw new SolanaError(SOLANA_ERROR__TRANSACTION__FEE_PAYER_SIGNATURE_MISSING);
    }
    return base58Decoder.decode(signatureBytes);
  }

  function uint8ArraysEqual(arr1, arr2) {
    return arr1.length === arr2.length && arr1.every((value, index) => value === arr2[index]);
  }

  function partiallySignTransaction(keyPairs, transaction) {
    let newSignatures;
    let unexpectedSigners;
    keyPairs.map((keyPair) => {
      const address2 = getAddressFromPublicKey(keyPair.publicKey);
      const existingSignature = transaction.signatures[address2];
      if(existingSignature === void 0) {
        unexpectedSigners || (unexpectedSigners = /* @__PURE__ */ new Set());
        unexpectedSigners.add(address2);
        return;
      }
      if(unexpectedSigners) {
        return;
      }
      const newSignature = signBytes(keyPair.privateKey, transaction.messageBytes);
      if(existingSignature !== null && uint8ArraysEqual(newSignature, existingSignature)) {
        return;
      }
      newSignatures || (newSignatures = {});
      newSignatures[address2] = newSignature;
    });

    if(unexpectedSigners && unexpectedSigners.size > 0) {
      const expectedSigners = Object.keys(transaction.signatures);
      throw new SolanaError(SOLANA_ERROR__TRANSACTION__ADDRESSES_CANNOT_SIGN_TRANSACTION, {
        expectedAddresses: expectedSigners,
        unexpectedAddresses: [...unexpectedSigners]
      });
    }
    if(!newSignatures) {
      return transaction;
    }
    return Object.freeze({
      ...transaction,
      signatures: Object.freeze({
        ...transaction.signatures,
        ...newSignatures
      })
    });
  }

  function signTransaction(keyPairs, transaction) {
    const out = partiallySignTransaction(keyPairs, transaction);
    assertTransactionIsFullySigned(out);
    Object.freeze(out);
    return out;
  }

  function assertTransactionIsFullySigned(transaction) {
    const missingSigs = [];
    Object.entries(transaction.signatures).forEach(([address2, signatureBytes]) => {
      if(!signatureBytes) {
        missingSigs.push(address2);
      }
    });
    if(missingSigs.length > 0) {
      throw new SolanaError(SOLANA_ERROR__TRANSACTION__SIGNATURES_MISSING, {
        addresses: missingSigs
      });
    }
  }

  function getBase64EncodedWireTransaction(transaction) {
    const wireTransactionBytes = getTransactionEncoder().encode(transaction);
    return getBase64Decoder().decode(wireTransactionBytes);
  }

  // ../signers/dist/index.browser.mjs
  function deduplicateSigners(signers) {
    const deduplicated = {};
    signers.forEach((signer) => {
      if(!deduplicated[signer.address]) {
        deduplicated[signer.address] = signer;
      }
      else if(deduplicated[signer.address] !== signer) {
        throw new SolanaError(SOLANA_ERROR__SIGNER__ADDRESS_CANNOT_HAVE_MULTIPLE_SIGNERS, {
          address: signer.address
        });
      }
    });
    return Object.values(deduplicated);
  }

  function isTransactionModifyingSigner(value) {
    return "modifyAndSignTransactions" in value && typeof value.modifyAndSignTransactions === "function";
  }

  function assertIsTransactionModifyingSigner(value) {
    if(!isTransactionModifyingSigner(value)) {
      throw new SolanaError(SOLANA_ERROR__SIGNER__EXPECTED_TRANSACTION_MODIFYING_SIGNER, {
        address: value.address
      });
    }
  }

  function isTransactionPartialSigner(value) {
    return "signTransactions" in value && typeof value.signTransactions === "function";
  }

  function assertIsTransactionPartialSigner(value) {
    if(!isTransactionPartialSigner(value)) {
      throw new SolanaError(SOLANA_ERROR__SIGNER__EXPECTED_TRANSACTION_PARTIAL_SIGNER, {
        address: value.address
      });
    }
  }

  function isTransactionSendingSigner(value) {
    return "signAndSendTransactions" in value && typeof value.signAndSendTransactions === "function";
  }

  function assertIsTransactionSendingSigner(value) {
    if(!isTransactionSendingSigner(value)) {
      throw new SolanaError(SOLANA_ERROR__SIGNER__EXPECTED_TRANSACTION_SENDING_SIGNER, {
        address: value.address
      });
    }
  }

  function isTransactionSigner(value) {
    return isTransactionPartialSigner(value) || isTransactionModifyingSigner(value) || isTransactionSendingSigner(value);
  }

  function assertIsTransactionSigner(value) {
    if(!isTransactionSigner(value)) {
      throw new SolanaError(SOLANA_ERROR__SIGNER__EXPECTED_TRANSACTION_SIGNER, {
        address: value.address
      });
    }
  }

  function getSignersFromInstruction(instruction) {
    var _a;
    return deduplicateSigners(
      ((_a = instruction.accounts) != null ? _a : []).flatMap((account) => "signer" in account ? account.signer : [])
    );
  }

  function getSignersFromTransactionMessage(transaction) {
    return deduplicateSigners([
      ...transaction.feePayer && isTransactionSigner(transaction.feePayer) ? [transaction.feePayer] : [],
      ...transaction.instructions.flatMap(getSignersFromInstruction)
    ]);
  }

  function addSignersToInstruction(signers, instruction) {
    if(!instruction.accounts || instruction.accounts.length === 0) {
      return instruction;
    }
    const signerByAddress = new Map(deduplicateSigners(signers).map((signer) => [signer.address, signer]));
    return Object.freeze({
      ...instruction,
      accounts: instruction.accounts.map((account) => {
        const signer = signerByAddress.get(account.address);
        if(!isSignerRole(account.role) || "signer" in account || !signer) {
          return account;
        }
        return Object.freeze({...account, signer});
      })
    });
  }

  function addSignersToTransactionMessage(signers, transactionMessage) {
    if(transactionMessage.instructions.length === 0) {
      return transactionMessage;
    }
    return Object.freeze({
      ...transactionMessage,
      instructions: transactionMessage.instructions.map((instruction) => addSignersToInstruction(signers, instruction))
    });
  }

  function setTransactionMessageFeePayerSigner(feePayer, transactionMessage) {
    Object.freeze(feePayer);
    const out = {...transactionMessage, feePayer};
    Object.freeze(out);
    return out;
  }

  function isMessagePartialSigner(value) {
    return "signMessages" in value && typeof value.signMessages === "function";
  }

  function assertIsMessagePartialSigner(value) {
    if(!isMessagePartialSigner(value)) {
      throw new SolanaError(SOLANA_ERROR__SIGNER__EXPECTED_MESSAGE_PARTIAL_SIGNER, {
        address: value.address
      });
    }
  }

  function isKeyPairSigner(value) {
    return "keyPair" in value && typeof value.keyPair === "object" && isMessagePartialSigner(value) && isTransactionPartialSigner(value);
  }

  function assertIsKeyPairSigner(value) {
    if(!isKeyPairSigner(value)) {
      throw new SolanaError(SOLANA_ERROR__SIGNER__EXPECTED_KEY_PAIR_SIGNER, {
        address: value.address
      });
    }
  }

  function createSignerFromKeyPair(keyPair) {
    const address2 = getAddressFromPublicKey(keyPair.publicKey);
    const out = {
      address: address2,
      keyPair,
      signMessages: (messages) => messages.map(
        (message) => Object.freeze({[address2]: signBytes(keyPair.privateKey, message.content)})
      ),
      signTransactions: (transactions) => transactions.map((transaction) => {
        const signedTransaction = partiallySignTransaction([keyPair], transaction);
        return Object.freeze({[address2]: signedTransaction.signatures[address2]});
      })
    };
    return Object.freeze(out);
  }

  function generateKeyPairSigner() {
    return createSignerFromKeyPair(generateKeyPair());
  }

  function createKeyPairSignerFromBytes(bytes, extractable) {
    return createSignerFromKeyPair(createKeyPairFromBytes(bytes, extractable));
  }

  function createKeyPairSignerFromPrivateKeyBytes(bytes, extractable) {
    return createSignerFromKeyPair(createKeyPairFromPrivateKeyBytes(bytes, extractable));
  }

  function isMessageModifyingSigner(value) {
    return isAddress(value.address) && "modifyAndSignMessages" in value && typeof value.modifyAndSignMessages === "function";
  }

  function assertIsMessageModifyingSigner(value) {
    if(!isMessageModifyingSigner(value)) {
      throw new SolanaError(SOLANA_ERROR__SIGNER__EXPECTED_MESSAGE_MODIFYING_SIGNER, {
        address: value.address
      });
    }
  }

  function isMessageSigner(value) {
    return isMessagePartialSigner(value) || isMessageModifyingSigner(value);
  }

  function assertIsMessageSigner(value) {
    if(!isMessageSigner(value)) {
      throw new SolanaError(SOLANA_ERROR__SIGNER__EXPECTED_MESSAGE_SIGNER, {
        address: value.address
      });
    }
  }

  function createNoopSigner(address2) {
    const out = {
      address: address2,
      signMessages: (messages) => messages.map(() => Object.freeze({})),
      signTransactions: (transactions) => transactions.map(() => Object.freeze({}))
    };
    return Object.freeze(out);
  }

  function isTransactionMessageWithSingleSendingSigner(transaction) {
    try {
      assertIsTransactionMessageWithSingleSendingSigner(transaction);
      return true;
    } catch {
      return false;
    }
  }

  function assertIsTransactionMessageWithSingleSendingSigner(transaction) {
    const signers = getSignersFromTransactionMessage(transaction);
    const sendingSigners = signers.filter(isTransactionSendingSigner);
    if(sendingSigners.length === 0) {
      throw new SolanaError(SOLANA_ERROR__SIGNER__TRANSACTION_SENDING_SIGNER_MISSING);
    }
    const sendingOnlySigners = sendingSigners.filter(
      (signer) => !isTransactionPartialSigner(signer) && !isTransactionModifyingSigner(signer)
    );
    if(sendingOnlySigners.length > 1) {
      throw new SolanaError(SOLANA_ERROR__SIGNER__TRANSACTION_CANNOT_HAVE_MULTIPLE_SENDING_SIGNERS);
    }
  }

  function partiallySignTransactionMessageWithSigners(transactionMessage, config) {
    const {partialSigners, modifyingSigners} = categorizeTransactionSigners(
      deduplicateSigners(getSignersFromTransactionMessage(transactionMessage).filter(isTransactionSigner)),
      {identifySendingSigner: false}
    );
    return signModifyingAndPartialTransactionSigners(
      transactionMessage,
      modifyingSigners,
      partialSigners,
      config
    );
  }

  function signTransactionMessageWithSigners(transactionMessage, config) {
    const signedTransaction = partiallySignTransactionMessageWithSigners(transactionMessage, config);
    assertTransactionIsFullySigned(signedTransaction);
    return signedTransaction;
  }

  function signAndSendTransactionMessageWithSigners(transaction, config) {
    assertIsTransactionMessageWithSingleSendingSigner(transaction);
    const abortSignal = config == null ? void 0 : config.abortSignal;
    const {partialSigners, modifyingSigners, sendingSigner} = categorizeTransactionSigners(
      deduplicateSigners(getSignersFromTransactionMessage(transaction).filter(isTransactionSigner))
    );
    abortSignal == null ? void 0 : abortSignal.throwIfAborted();
    const signedTransaction = signModifyingAndPartialTransactionSigners(
      transaction,
      modifyingSigners,
      partialSigners,
      config
    );
    if(!sendingSigner) {
      throw new SolanaError(SOLANA_ERROR__SIGNER__TRANSACTION_SENDING_SIGNER_MISSING);
    }
    abortSignal == null ? void 0 : abortSignal.throwIfAborted();
    const [signature2] = sendingSigner.signAndSendTransactions([signedTransaction], config);
    abortSignal == null ? void 0 : abortSignal.throwIfAborted();
    return signature2;
  }

  function categorizeTransactionSigners(signers, config = {}) {
    var _a;
    const identifySendingSigner = (_a = config.identifySendingSigner) != null ? _a : true;
    const sendingSigner = identifySendingSigner ? identifyTransactionSendingSigner(signers) : null;
    const otherSigners = signers.filter(
      (signer) => signer !== sendingSigner && (isTransactionModifyingSigner(signer) || isTransactionPartialSigner(signer))
    );
    const modifyingSigners = identifyTransactionModifyingSigners(otherSigners);
    const partialSigners = otherSigners.filter(isTransactionPartialSigner).filter((signer) => !modifyingSigners.includes(signer));
    return Object.freeze({modifyingSigners, partialSigners, sendingSigner});
  }

  function identifyTransactionSendingSigner(signers) {
    const sendingSigners = signers.filter(isTransactionSendingSigner);
    if(sendingSigners.length === 0) return null;
    const sendingOnlySigners = sendingSigners.filter(
      (signer) => !isTransactionModifyingSigner(signer) && !isTransactionPartialSigner(signer)
    );
    if(sendingOnlySigners.length > 0) {
      return sendingOnlySigners[0];
    }
    return sendingSigners[0];
  }

  function identifyTransactionModifyingSigners(signers) {
    const modifyingSigners = signers.filter(isTransactionModifyingSigner);
    if(modifyingSigners.length === 0) return [];
    const nonPartialSigners = modifyingSigners.filter((signer) => !isTransactionPartialSigner(signer));
    if(nonPartialSigners.length > 0) return nonPartialSigners;
    return [modifyingSigners[0]];
  }

  function signModifyingAndPartialTransactionSigners(transactionMessage, modifyingSigners = [], partialSigners = [], config) {
    var _a, _b;
    const transaction = compileTransaction(transactionMessage);
    const modifiedTransaction = modifyingSigners.reduce(
      (transaction2, modifyingSigner) => {
        var _a2;
        (_a2 = config == null ? void 0 : config.abortSignal) == null ? void 0 : _a2.throwIfAborted();
        const [tx] = modifyingSigner.modifyAndSignTransactions([transaction2], config);
        return Object.freeze(tx);
      },
      transaction
    );
    (_a = config == null ? void 0 : config.abortSignal) == null ? void 0 : _a.throwIfAborted();
    const signatureDictionaries = partialSigners.map((partialSigner) => {
      const [signatures] = partialSigner.signTransactions([modifiedTransaction], config);
      return signatures;
    });
    const signedTransaction = {
      ...modifiedTransaction,
      signatures: Object.freeze(
        signatureDictionaries.reduce((signatures, signatureDictionary) => {
          return {...signatures, ...signatureDictionary};
        }, (_b = modifiedTransaction.signatures) != null ? _b : {})
      )
    };
    return Object.freeze(signedTransaction);
  }

  var o2 = globalThis.TextEncoder;

  function createSignableMessage(content, signatures = {}) {
    return Object.freeze({
      content: typeof content === "string" ? new o2().encode(content) : content,
      signatures: Object.freeze({...signatures})
    });
  }


  // src/compute-limit-internal.ts
  var COMPUTE_BUDGET_PROGRAM_ADDRESS = "ComputeBudget111111111111111111111111111111";
  var INVALID_BUT_SUFFICIENT_FOR_COMPILATION_BLOCKHASH = {
    blockhash: "11111111111111111111111111111111",
    lastValidBlockHeight: 0n
    // This is not included in compiled transactions; it can be anything.
  };
  var SET_COMPUTE_UNIT_LIMIT_INSTRUCTION_INDEX = 2;

  function createComputeUnitLimitInstruction(units) {
    const data = new Uint8Array(5);
    data[0] = SET_COMPUTE_UNIT_LIMIT_INSTRUCTION_INDEX;
    getU32Encoder().write(
      units,
      data,
      1
      /* offset */
    );
    return Object.freeze({
      data,
      programAddress: COMPUTE_BUDGET_PROGRAM_ADDRESS
    });
  }

  function isSetComputeLimitInstruction(instruction) {
    return isInstructionForProgram(instruction, COMPUTE_BUDGET_PROGRAM_ADDRESS)
      && isInstructionWithData(instruction)
      && instruction.data[0] === SET_COMPUTE_UNIT_LIMIT_INSTRUCTION_INDEX;
  }

  function getComputeUnitEstimateForTransactionMessage_INTERNAL_ONLY_DO_NOT_EXPORT({
    abortSignal,
    rpc,
    transactionMessage,
    ...simulateConfig
  }) {
    const isDurableNonceTransactionMessage = isDurableNonceTransaction(transactionMessage);
    let compilableTransactionMessage;
    if(isDurableNonceTransactionMessage || isTransactionMessageWithBlockhashLifetime(transactionMessage)) {
      compilableTransactionMessage = transactionMessage;
    }
    else {
      compilableTransactionMessage = setTransactionMessageLifetimeUsingBlockhash(
        INVALID_BUT_SUFFICIENT_FOR_COMPILATION_BLOCKHASH,
        transactionMessage
      );
    }
    const existingSetComputeUnitLimitInstructionIndex = transactionMessage.instructions.findIndex(isSetComputeLimitInstruction);
    const maxComputeUnitLimitInstruction = createComputeUnitLimitInstruction(
      14e5
      /* MAX_COMPUTE_UNIT_LIMIT */
    );
    if(existingSetComputeUnitLimitInstructionIndex === -1) {
      compilableTransactionMessage = appendTransactionMessageInstruction(
        maxComputeUnitLimitInstruction,
        compilableTransactionMessage
      );
    }
    else {
      const nextInstructions = [...compilableTransactionMessage.instructions];
      nextInstructions.splice(existingSetComputeUnitLimitInstructionIndex, 1, maxComputeUnitLimitInstruction);
      compilableTransactionMessage = Object.freeze({
        ...compilableTransactionMessage,
        instructions: nextInstructions
      });
    }
    const compiledTransaction = compileTransaction(compilableTransactionMessage);
    const wireTransactionBytes = getBase64EncodedWireTransaction(compiledTransaction);
    try {
      const {
        value: {err: transactionError, unitsConsumed}
      } = rpc.simulateTransaction(wireTransactionBytes, {
        ...simulateConfig,
        encoding: "base64",
        replaceRecentBlockhash: !isDurableNonceTransactionMessage,
        sigVerify: false
      }).send({abortSignal});
      if(unitsConsumed == null) {
        throw new SolanaError(SOLANA_ERROR__TRANSACTION__FAILED_TO_ESTIMATE_COMPUTE_LIMIT);
      }
      const downcastUnitsConsumed = unitsConsumed > 4294967295n ? 4294967295 : Number(unitsConsumed);
      if(transactionError) {
        throw new SolanaError(SOLANA_ERROR__TRANSACTION__FAILED_WHEN_SIMULATING_TO_ESTIMATE_COMPUTE_LIMIT, {
          cause: transactionError,
          unitsConsumed: downcastUnitsConsumed
        });
      }
      return downcastUnitsConsumed;
    } catch(e3) {
      if(isSolanaError(e3, SOLANA_ERROR__TRANSACTION__FAILED_WHEN_SIMULATING_TO_ESTIMATE_COMPUTE_LIMIT)) throw e3;
      throw new SolanaError(SOLANA_ERROR__TRANSACTION__FAILED_TO_ESTIMATE_COMPUTE_LIMIT, {
        cause: e3
      });
    }
  }

  // src/compute-limit.ts
  function getComputeUnitEstimateForTransactionMessageFactory({
    rpc
  }) {
    return function getComputeUnitEstimateForTransactionMessage(transactionMessage, config) {
      return getComputeUnitEstimateForTransactionMessage_INTERNAL_ONLY_DO_NOT_EXPORT({
        ...config,
        rpc,
        transactionMessage
      });
    };
  }

  // src/decompile-transaction-message-fetching-lookup-tables.ts
  function fetchLookupTables(lookupTableAddresses, rpc, config) {
    const fetchedLookupTables = fetchJsonParsedAccounts(
      rpc,
      lookupTableAddresses,
      config
    );
    assertAccountsDecoded(fetchedLookupTables);
    assertAccountsExist(fetchedLookupTables);
    return fetchedLookupTables.reduce((acc, lookup) => {
      return {
        ...acc,
        [lookup.address]: lookup.data.addresses
      };
    }, {});
  }

  function decompileTransactionMessageFetchingLookupTables(compiledTransactionMessage, rpc, config) {
    const lookupTables = "addressTableLookups" in compiledTransactionMessage && compiledTransactionMessage.addressTableLookups !== void 0 && compiledTransactionMessage.addressTableLookups.length > 0 ? compiledTransactionMessage.addressTableLookups : [];
    const lookupTableAddresses = lookupTables.map((l) => l.lookupTableAddress);
    const {lastValidBlockHeight, ...fetchAccountsConfig} = config != null ? config : {};
    const addressesByLookupTableAddress = lookupTableAddresses.length > 0 ? fetchLookupTables(lookupTableAddresses, rpc, fetchAccountsConfig) : {};
    return decompileTransactionMessage(compiledTransactionMessage, {
      addressesByLookupTableAddress,
      lastValidBlockHeight
    });
  }

  // src/send-transaction-internal.ts
  function getSendTransactionConfigWithAdjustedPreflightCommitment(commitment, config) {
    if(
      // The developer has supplied no value for `preflightCommitment`.
      !(config == null ? void 0 : config.preflightCommitment) && // The value of `commitment` is lower than the server default of `preflightCommitment`.
      commitmentComparator(
        commitment,
        "finalized"
        /* default value of `preflightCommitment` */
      ) < 0
    ) {
      return {
        ...config,
        // In the common case, it is unlikely that you want to simulate a transaction at
        // `finalized` commitment when your standard of commitment for confirming the
        // transaction is lower. Cap the simulation commitment level to the level of the
        // confirmation commitment.
        preflightCommitment: commitment
      };
    }
    return config;
  }

  function sendTransaction_INTERNAL_ONLY_DO_NOT_EXPORT({
    abortSignal,
    commitment,
    rpc,
    transaction,
    ...sendTransactionConfig
  }) {
    const base64EncodedWireTransaction = getBase64EncodedWireTransaction(transaction);
    return rpc.sendTransaction(base64EncodedWireTransaction, {
      ...getSendTransactionConfigWithAdjustedPreflightCommitment(commitment, sendTransactionConfig),
      encoding: "base64"
    }).send({abortSignal});
  }

  // src/send-transaction-without-confirming.ts
  function sendTransactionWithoutConfirmingFactory({
    rpc
  }) {
    return function sendTransactionWithoutConfirming(transaction, config) {
      sendTransaction_INTERNAL_ONLY_DO_NOT_EXPORT({
        ...config,
        rpc,
        transaction
      });
    };
  }


  class Buffer {
    constructor(data) {
      // 直接使用DataView来处理字节序
      this.data = new Uint8Array(data);
      this.view = new DataView(this.data.buffer);
      this.offset = 0;
    }
  
    static from(data, encoding = 'utf8') {
      if (encoding === 'base64') {
        // 使用Java的Base64解码
        const Base64 = Java.type('java.util.Base64');
        const decoder = Base64.getDecoder();
        const bytes = decoder.decode(data);
        return new Buffer(bytes);
      } 
      
      if (encoding === 'hex') {
        return new Buffer(
          Uint8Array.from(data.match(/.{1,2}/g) || [], byte => parseInt(byte, 16))
        );
      } 
      
      if (data instanceof Uint8Array) {
        return new Buffer(data);
      }
      
      return new Buffer(new TextEncoder().encode(data));
    }
  
    toString(encoding = 'utf8') {
      if (encoding === 'base64') {
        // 使用Java的Base64编码
        const Base64 = Java.type('java.util.Base64');
        const encoder = Base64.getEncoder();
        return encoder.encodeToString(this.data);
      }
      
      if (encoding === 'hex') {
        return Array.from(this.data)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      }
      
      return new TextDecoder().decode(this.data);
    }
  
    readUInt8(offset = null) {
      if (offset !== null) this.offset = offset;
      const value = this.view.getUint8(this.offset);
      this.offset += 1;
      return value;
    }
  
    readUInt32LE(offset = null) {
      if (offset !== null) this.offset = offset;
      const value = this.view.getUint32(this.offset, true); // true表示小端序
      this.offset += 4;
      return value;
    }
  
    readBigUInt64LE(offset = null) {
      if (offset !== null) this.offset = offset;
      const value = this.view.getBigUint64(this.offset, true);
      this.offset += 8;
      return value;
    }
  
    readPubkey(offset = null) {
      if (offset !== null) this.offset = offset;
      const pubkeyData = this.data.slice(this.offset, this.offset + 32);
      this.offset += 32;
      return getAddressDecoder().decode(pubkeyData);
    }

    readPubkeyArray(count, offset = null) {
      if(offset !== null) this.offset = offset;
      const pubkeys = [];
      for(let i = 0; i < count; i++) {
        pubkeys.push(this.readPubkey());
      }
      return pubkeys;
    }
  
    slice(start, end) {
      return new Buffer(this.data.slice(start, end));
    }
  
    toArray() {
      return this.data;
    }
  
    get length() {
      return this.data.length;
    }
  }


  const exports = {};
  exports.AccountRole = AccountRole;
  exports.BASE_ACCOUNT_SIZE = BASE_ACCOUNT_SIZE;
  exports.DEFAULT_RPC_CONFIG = DEFAULT_RPC_CONFIG;
  exports.Endian = Endian;
  exports.SOLANA_ERROR__ACCOUNTS__ACCOUNT_NOT_FOUND = SOLANA_ERROR__ACCOUNTS__ACCOUNT_NOT_FOUND;
  exports.SOLANA_ERROR__ACCOUNTS__EXPECTED_ALL_ACCOUNTS_TO_BE_DECODED = SOLANA_ERROR__ACCOUNTS__EXPECTED_ALL_ACCOUNTS_TO_BE_DECODED;
  exports.SOLANA_ERROR__ACCOUNTS__EXPECTED_DECODED_ACCOUNT = SOLANA_ERROR__ACCOUNTS__EXPECTED_DECODED_ACCOUNT;
  exports.SOLANA_ERROR__ACCOUNTS__FAILED_TO_DECODE_ACCOUNT = SOLANA_ERROR__ACCOUNTS__FAILED_TO_DECODE_ACCOUNT;
  exports.SOLANA_ERROR__ACCOUNTS__ONE_OR_MORE_ACCOUNTS_NOT_FOUND = SOLANA_ERROR__ACCOUNTS__ONE_OR_MORE_ACCOUNTS_NOT_FOUND;
  exports.SOLANA_ERROR__ADDRESSES__FAILED_TO_FIND_VIABLE_PDA_BUMP_SEED = SOLANA_ERROR__ADDRESSES__FAILED_TO_FIND_VIABLE_PDA_BUMP_SEED;
  exports.SOLANA_ERROR__ADDRESSES__INVALID_BASE58_ENCODED_ADDRESS = SOLANA_ERROR__ADDRESSES__INVALID_BASE58_ENCODED_ADDRESS;
  exports.SOLANA_ERROR__ADDRESSES__INVALID_BYTE_LENGTH = SOLANA_ERROR__ADDRESSES__INVALID_BYTE_LENGTH;
  exports.SOLANA_ERROR__ADDRESSES__INVALID_ED25519_PUBLIC_KEY = SOLANA_ERROR__ADDRESSES__INVALID_ED25519_PUBLIC_KEY;
  exports.SOLANA_ERROR__ADDRESSES__INVALID_SEEDS_POINT_ON_CURVE = SOLANA_ERROR__ADDRESSES__INVALID_SEEDS_POINT_ON_CURVE;
  exports.SOLANA_ERROR__ADDRESSES__MALFORMED_PDA = SOLANA_ERROR__ADDRESSES__MALFORMED_PDA;
  exports.SOLANA_ERROR__ADDRESSES__MAX_NUMBER_OF_PDA_SEEDS_EXCEEDED = SOLANA_ERROR__ADDRESSES__MAX_NUMBER_OF_PDA_SEEDS_EXCEEDED;
  exports.SOLANA_ERROR__ADDRESSES__MAX_PDA_SEED_LENGTH_EXCEEDED = SOLANA_ERROR__ADDRESSES__MAX_PDA_SEED_LENGTH_EXCEEDED;
  exports.SOLANA_ERROR__ADDRESSES__PDA_BUMP_SEED_OUT_OF_RANGE = SOLANA_ERROR__ADDRESSES__PDA_BUMP_SEED_OUT_OF_RANGE;
  exports.SOLANA_ERROR__ADDRESSES__PDA_ENDS_WITH_PDA_MARKER = SOLANA_ERROR__ADDRESSES__PDA_ENDS_WITH_PDA_MARKER;
  exports.SOLANA_ERROR__ADDRESSES__STRING_LENGTH_OUT_OF_RANGE = SOLANA_ERROR__ADDRESSES__STRING_LENGTH_OUT_OF_RANGE;
  exports.SOLANA_ERROR__BLOCKHASH_STRING_LENGTH_OUT_OF_RANGE = SOLANA_ERROR__BLOCKHASH_STRING_LENGTH_OUT_OF_RANGE;
  exports.SOLANA_ERROR__BLOCK_HEIGHT_EXCEEDED = SOLANA_ERROR__BLOCK_HEIGHT_EXCEEDED;
  exports.SOLANA_ERROR__CODECS__CANNOT_DECODE_EMPTY_BYTE_ARRAY = SOLANA_ERROR__CODECS__CANNOT_DECODE_EMPTY_BYTE_ARRAY;
  exports.SOLANA_ERROR__CODECS__CANNOT_USE_LEXICAL_VALUES_AS_ENUM_DISCRIMINATORS = SOLANA_ERROR__CODECS__CANNOT_USE_LEXICAL_VALUES_AS_ENUM_DISCRIMINATORS;
  exports.SOLANA_ERROR__CODECS__ENCODED_BYTES_MUST_NOT_INCLUDE_SENTINEL = SOLANA_ERROR__CODECS__ENCODED_BYTES_MUST_NOT_INCLUDE_SENTINEL;
  exports.SOLANA_ERROR__CODECS__ENCODER_DECODER_FIXED_SIZE_MISMATCH = SOLANA_ERROR__CODECS__ENCODER_DECODER_FIXED_SIZE_MISMATCH;
  exports.SOLANA_ERROR__CODECS__ENCODER_DECODER_MAX_SIZE_MISMATCH = SOLANA_ERROR__CODECS__ENCODER_DECODER_MAX_SIZE_MISMATCH;
  exports.SOLANA_ERROR__CODECS__ENCODER_DECODER_SIZE_COMPATIBILITY_MISMATCH = SOLANA_ERROR__CODECS__ENCODER_DECODER_SIZE_COMPATIBILITY_MISMATCH;
  exports.SOLANA_ERROR__CODECS__ENUM_DISCRIMINATOR_OUT_OF_RANGE = SOLANA_ERROR__CODECS__ENUM_DISCRIMINATOR_OUT_OF_RANGE;
  exports.SOLANA_ERROR__CODECS__EXPECTED_FIXED_LENGTH = SOLANA_ERROR__CODECS__EXPECTED_FIXED_LENGTH;
  exports.SOLANA_ERROR__CODECS__EXPECTED_POSITIVE_BYTE_LENGTH = SOLANA_ERROR__CODECS__EXPECTED_POSITIVE_BYTE_LENGTH;
  exports.SOLANA_ERROR__CODECS__EXPECTED_VARIABLE_LENGTH = SOLANA_ERROR__CODECS__EXPECTED_VARIABLE_LENGTH;
  exports.SOLANA_ERROR__CODECS__EXPECTED_ZERO_VALUE_TO_MATCH_ITEM_FIXED_SIZE = SOLANA_ERROR__CODECS__EXPECTED_ZERO_VALUE_TO_MATCH_ITEM_FIXED_SIZE;
  exports.SOLANA_ERROR__CODECS__INVALID_BYTE_LENGTH = SOLANA_ERROR__CODECS__INVALID_BYTE_LENGTH;
  exports.SOLANA_ERROR__CODECS__INVALID_CONSTANT = SOLANA_ERROR__CODECS__INVALID_CONSTANT;
  exports.SOLANA_ERROR__CODECS__INVALID_DISCRIMINATED_UNION_VARIANT = SOLANA_ERROR__CODECS__INVALID_DISCRIMINATED_UNION_VARIANT;
  exports.SOLANA_ERROR__CODECS__INVALID_ENUM_VARIANT = SOLANA_ERROR__CODECS__INVALID_ENUM_VARIANT;
  exports.SOLANA_ERROR__CODECS__INVALID_LITERAL_UNION_VARIANT = SOLANA_ERROR__CODECS__INVALID_LITERAL_UNION_VARIANT;
  exports.SOLANA_ERROR__CODECS__INVALID_NUMBER_OF_ITEMS = SOLANA_ERROR__CODECS__INVALID_NUMBER_OF_ITEMS;
  exports.SOLANA_ERROR__CODECS__INVALID_STRING_FOR_BASE = SOLANA_ERROR__CODECS__INVALID_STRING_FOR_BASE;
  exports.SOLANA_ERROR__CODECS__LITERAL_UNION_DISCRIMINATOR_OUT_OF_RANGE = SOLANA_ERROR__CODECS__LITERAL_UNION_DISCRIMINATOR_OUT_OF_RANGE;
  exports.SOLANA_ERROR__CODECS__NUMBER_OUT_OF_RANGE = SOLANA_ERROR__CODECS__NUMBER_OUT_OF_RANGE;
  exports.SOLANA_ERROR__CODECS__OFFSET_OUT_OF_RANGE = SOLANA_ERROR__CODECS__OFFSET_OUT_OF_RANGE;
  exports.SOLANA_ERROR__CODECS__SENTINEL_MISSING_IN_DECODED_BYTES = SOLANA_ERROR__CODECS__SENTINEL_MISSING_IN_DECODED_BYTES;
  exports.SOLANA_ERROR__CODECS__UNION_VARIANT_OUT_OF_RANGE = SOLANA_ERROR__CODECS__UNION_VARIANT_OUT_OF_RANGE;
  exports.SOLANA_ERROR__CRYPTO__RANDOM_VALUES_FUNCTION_UNIMPLEMENTED = SOLANA_ERROR__CRYPTO__RANDOM_VALUES_FUNCTION_UNIMPLEMENTED;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_ALREADY_INITIALIZED = SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_ALREADY_INITIALIZED;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_BORROW_FAILED = SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_BORROW_FAILED;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_BORROW_OUTSTANDING = SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_BORROW_OUTSTANDING;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_DATA_SIZE_CHANGED = SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_DATA_SIZE_CHANGED;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_DATA_TOO_SMALL = SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_DATA_TOO_SMALL;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_NOT_EXECUTABLE = SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_NOT_EXECUTABLE;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_NOT_RENT_EXEMPT = SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_NOT_RENT_EXEMPT;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__ARITHMETIC_OVERFLOW = SOLANA_ERROR__INSTRUCTION_ERROR__ARITHMETIC_OVERFLOW;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__BORSH_IO_ERROR = SOLANA_ERROR__INSTRUCTION_ERROR__BORSH_IO_ERROR;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__BUILTIN_PROGRAMS_MUST_CONSUME_COMPUTE_UNITS = SOLANA_ERROR__INSTRUCTION_ERROR__BUILTIN_PROGRAMS_MUST_CONSUME_COMPUTE_UNITS;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__CALL_DEPTH = SOLANA_ERROR__INSTRUCTION_ERROR__CALL_DEPTH;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__COMPUTATIONAL_BUDGET_EXCEEDED = SOLANA_ERROR__INSTRUCTION_ERROR__COMPUTATIONAL_BUDGET_EXCEEDED;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM = SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__DUPLICATE_ACCOUNT_INDEX = SOLANA_ERROR__INSTRUCTION_ERROR__DUPLICATE_ACCOUNT_INDEX;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__DUPLICATE_ACCOUNT_OUT_OF_SYNC = SOLANA_ERROR__INSTRUCTION_ERROR__DUPLICATE_ACCOUNT_OUT_OF_SYNC;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__EXECUTABLE_ACCOUNT_NOT_RENT_EXEMPT = SOLANA_ERROR__INSTRUCTION_ERROR__EXECUTABLE_ACCOUNT_NOT_RENT_EXEMPT;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__EXECUTABLE_DATA_MODIFIED = SOLANA_ERROR__INSTRUCTION_ERROR__EXECUTABLE_DATA_MODIFIED;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__EXECUTABLE_LAMPORT_CHANGE = SOLANA_ERROR__INSTRUCTION_ERROR__EXECUTABLE_LAMPORT_CHANGE;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__EXECUTABLE_MODIFIED = SOLANA_ERROR__INSTRUCTION_ERROR__EXECUTABLE_MODIFIED;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__EXTERNAL_ACCOUNT_DATA_MODIFIED = SOLANA_ERROR__INSTRUCTION_ERROR__EXTERNAL_ACCOUNT_DATA_MODIFIED;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__EXTERNAL_ACCOUNT_LAMPORT_SPEND = SOLANA_ERROR__INSTRUCTION_ERROR__EXTERNAL_ACCOUNT_LAMPORT_SPEND;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__GENERIC_ERROR = SOLANA_ERROR__INSTRUCTION_ERROR__GENERIC_ERROR;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__ILLEGAL_OWNER = SOLANA_ERROR__INSTRUCTION_ERROR__ILLEGAL_OWNER;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__IMMUTABLE = SOLANA_ERROR__INSTRUCTION_ERROR__IMMUTABLE;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__INCORRECT_AUTHORITY = SOLANA_ERROR__INSTRUCTION_ERROR__INCORRECT_AUTHORITY;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__INCORRECT_PROGRAM_ID = SOLANA_ERROR__INSTRUCTION_ERROR__INCORRECT_PROGRAM_ID;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__INSUFFICIENT_FUNDS = SOLANA_ERROR__INSTRUCTION_ERROR__INSUFFICIENT_FUNDS;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_ACCOUNT_DATA = SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_ACCOUNT_DATA;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_ACCOUNT_OWNER = SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_ACCOUNT_OWNER;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_ARGUMENT = SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_ARGUMENT;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_ERROR = SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_ERROR;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_INSTRUCTION_DATA = SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_INSTRUCTION_DATA;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_REALLOC = SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_REALLOC;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_SEEDS = SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_SEEDS;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__MAX_ACCOUNTS_DATA_ALLOCATIONS_EXCEEDED = SOLANA_ERROR__INSTRUCTION_ERROR__MAX_ACCOUNTS_DATA_ALLOCATIONS_EXCEEDED;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__MAX_ACCOUNTS_EXCEEDED = SOLANA_ERROR__INSTRUCTION_ERROR__MAX_ACCOUNTS_EXCEEDED;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__MAX_INSTRUCTION_TRACE_LENGTH_EXCEEDED = SOLANA_ERROR__INSTRUCTION_ERROR__MAX_INSTRUCTION_TRACE_LENGTH_EXCEEDED;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__MAX_SEED_LENGTH_EXCEEDED = SOLANA_ERROR__INSTRUCTION_ERROR__MAX_SEED_LENGTH_EXCEEDED;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__MISSING_ACCOUNT = SOLANA_ERROR__INSTRUCTION_ERROR__MISSING_ACCOUNT;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__MISSING_REQUIRED_SIGNATURE = SOLANA_ERROR__INSTRUCTION_ERROR__MISSING_REQUIRED_SIGNATURE;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__MODIFIED_PROGRAM_ID = SOLANA_ERROR__INSTRUCTION_ERROR__MODIFIED_PROGRAM_ID;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__NOT_ENOUGH_ACCOUNT_KEYS = SOLANA_ERROR__INSTRUCTION_ERROR__NOT_ENOUGH_ACCOUNT_KEYS;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__PRIVILEGE_ESCALATION = SOLANA_ERROR__INSTRUCTION_ERROR__PRIVILEGE_ESCALATION;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__PROGRAM_ENVIRONMENT_SETUP_FAILURE = SOLANA_ERROR__INSTRUCTION_ERROR__PROGRAM_ENVIRONMENT_SETUP_FAILURE;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__PROGRAM_FAILED_TO_COMPILE = SOLANA_ERROR__INSTRUCTION_ERROR__PROGRAM_FAILED_TO_COMPILE;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__PROGRAM_FAILED_TO_COMPLETE = SOLANA_ERROR__INSTRUCTION_ERROR__PROGRAM_FAILED_TO_COMPLETE;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__READONLY_DATA_MODIFIED = SOLANA_ERROR__INSTRUCTION_ERROR__READONLY_DATA_MODIFIED;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__READONLY_LAMPORT_CHANGE = SOLANA_ERROR__INSTRUCTION_ERROR__READONLY_LAMPORT_CHANGE;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__REENTRANCY_NOT_ALLOWED = SOLANA_ERROR__INSTRUCTION_ERROR__REENTRANCY_NOT_ALLOWED;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__RENT_EPOCH_MODIFIED = SOLANA_ERROR__INSTRUCTION_ERROR__RENT_EPOCH_MODIFIED;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__UNBALANCED_INSTRUCTION = SOLANA_ERROR__INSTRUCTION_ERROR__UNBALANCED_INSTRUCTION;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__UNINITIALIZED_ACCOUNT = SOLANA_ERROR__INSTRUCTION_ERROR__UNINITIALIZED_ACCOUNT;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__UNKNOWN = SOLANA_ERROR__INSTRUCTION_ERROR__UNKNOWN;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__UNSUPPORTED_PROGRAM_ID = SOLANA_ERROR__INSTRUCTION_ERROR__UNSUPPORTED_PROGRAM_ID;
  exports.SOLANA_ERROR__INSTRUCTION_ERROR__UNSUPPORTED_SYSVAR = SOLANA_ERROR__INSTRUCTION_ERROR__UNSUPPORTED_SYSVAR;
  exports.SOLANA_ERROR__INSTRUCTION__EXPECTED_TO_HAVE_ACCOUNTS = SOLANA_ERROR__INSTRUCTION__EXPECTED_TO_HAVE_ACCOUNTS;
  exports.SOLANA_ERROR__INSTRUCTION__EXPECTED_TO_HAVE_DATA = SOLANA_ERROR__INSTRUCTION__EXPECTED_TO_HAVE_DATA;
  exports.SOLANA_ERROR__INSTRUCTION__PROGRAM_ID_MISMATCH = SOLANA_ERROR__INSTRUCTION__PROGRAM_ID_MISMATCH;
  exports.SOLANA_ERROR__INVALID_BLOCKHASH_BYTE_LENGTH = SOLANA_ERROR__INVALID_BLOCKHASH_BYTE_LENGTH;
  exports.SOLANA_ERROR__INVALID_NONCE = SOLANA_ERROR__INVALID_NONCE;
  exports.SOLANA_ERROR__INVARIANT_VIOLATION__CACHED_ABORTABLE_ITERABLE_CACHE_ENTRY_MISSING = SOLANA_ERROR__INVARIANT_VIOLATION__CACHED_ABORTABLE_ITERABLE_CACHE_ENTRY_MISSING;
  exports.SOLANA_ERROR__INVARIANT_VIOLATION__DATA_PUBLISHER_CHANNEL_UNIMPLEMENTED = SOLANA_ERROR__INVARIANT_VIOLATION__DATA_PUBLISHER_CHANNEL_UNIMPLEMENTED;
  exports.SOLANA_ERROR__INVARIANT_VIOLATION__SUBSCRIPTION_ITERATOR_MUST_NOT_POLL_BEFORE_RESOLVING_EXISTING_MESSAGE_PROMISE = SOLANA_ERROR__INVARIANT_VIOLATION__SUBSCRIPTION_ITERATOR_MUST_NOT_POLL_BEFORE_RESOLVING_EXISTING_MESSAGE_PROMISE;
  exports.SOLANA_ERROR__INVARIANT_VIOLATION__SUBSCRIPTION_ITERATOR_STATE_MISSING = SOLANA_ERROR__INVARIANT_VIOLATION__SUBSCRIPTION_ITERATOR_STATE_MISSING;
  exports.SOLANA_ERROR__INVARIANT_VIOLATION__SWITCH_MUST_BE_EXHAUSTIVE = SOLANA_ERROR__INVARIANT_VIOLATION__SWITCH_MUST_BE_EXHAUSTIVE;
  exports.SOLANA_ERROR__JSON_RPC__INTERNAL_ERROR = SOLANA_ERROR__JSON_RPC__INTERNAL_ERROR;
  exports.SOLANA_ERROR__JSON_RPC__INVALID_PARAMS = SOLANA_ERROR__JSON_RPC__INVALID_PARAMS;
  exports.SOLANA_ERROR__JSON_RPC__INVALID_REQUEST = SOLANA_ERROR__JSON_RPC__INVALID_REQUEST;
  exports.SOLANA_ERROR__JSON_RPC__METHOD_NOT_FOUND = SOLANA_ERROR__JSON_RPC__METHOD_NOT_FOUND;
  exports.SOLANA_ERROR__JSON_RPC__PARSE_ERROR = SOLANA_ERROR__JSON_RPC__PARSE_ERROR;
  exports.SOLANA_ERROR__JSON_RPC__SCAN_ERROR = SOLANA_ERROR__JSON_RPC__SCAN_ERROR;
  exports.SOLANA_ERROR__JSON_RPC__SERVER_ERROR_BLOCK_CLEANED_UP = SOLANA_ERROR__JSON_RPC__SERVER_ERROR_BLOCK_CLEANED_UP;
  exports.SOLANA_ERROR__JSON_RPC__SERVER_ERROR_BLOCK_NOT_AVAILABLE = SOLANA_ERROR__JSON_RPC__SERVER_ERROR_BLOCK_NOT_AVAILABLE;
  exports.SOLANA_ERROR__JSON_RPC__SERVER_ERROR_BLOCK_STATUS_NOT_AVAILABLE_YET = SOLANA_ERROR__JSON_RPC__SERVER_ERROR_BLOCK_STATUS_NOT_AVAILABLE_YET;
  exports.SOLANA_ERROR__JSON_RPC__SERVER_ERROR_KEY_EXCLUDED_FROM_SECONDARY_INDEX = SOLANA_ERROR__JSON_RPC__SERVER_ERROR_KEY_EXCLUDED_FROM_SECONDARY_INDEX;
  exports.SOLANA_ERROR__JSON_RPC__SERVER_ERROR_LONG_TERM_STORAGE_SLOT_SKIPPED = SOLANA_ERROR__JSON_RPC__SERVER_ERROR_LONG_TERM_STORAGE_SLOT_SKIPPED;
  exports.SOLANA_ERROR__JSON_RPC__SERVER_ERROR_MIN_CONTEXT_SLOT_NOT_REACHED = SOLANA_ERROR__JSON_RPC__SERVER_ERROR_MIN_CONTEXT_SLOT_NOT_REACHED;
  exports.SOLANA_ERROR__JSON_RPC__SERVER_ERROR_NODE_UNHEALTHY = SOLANA_ERROR__JSON_RPC__SERVER_ERROR_NODE_UNHEALTHY;
  exports.SOLANA_ERROR__JSON_RPC__SERVER_ERROR_NO_SNAPSHOT = SOLANA_ERROR__JSON_RPC__SERVER_ERROR_NO_SNAPSHOT;
  exports.SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE = SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE;
  exports.SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SLOT_SKIPPED = SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SLOT_SKIPPED;
  exports.SOLANA_ERROR__JSON_RPC__SERVER_ERROR_TRANSACTION_HISTORY_NOT_AVAILABLE = SOLANA_ERROR__JSON_RPC__SERVER_ERROR_TRANSACTION_HISTORY_NOT_AVAILABLE;
  exports.SOLANA_ERROR__JSON_RPC__SERVER_ERROR_TRANSACTION_PRECOMPILE_VERIFICATION_FAILURE = SOLANA_ERROR__JSON_RPC__SERVER_ERROR_TRANSACTION_PRECOMPILE_VERIFICATION_FAILURE;
  exports.SOLANA_ERROR__JSON_RPC__SERVER_ERROR_TRANSACTION_SIGNATURE_LEN_MISMATCH = SOLANA_ERROR__JSON_RPC__SERVER_ERROR_TRANSACTION_SIGNATURE_LEN_MISMATCH;
  exports.SOLANA_ERROR__JSON_RPC__SERVER_ERROR_TRANSACTION_SIGNATURE_VERIFICATION_FAILURE = SOLANA_ERROR__JSON_RPC__SERVER_ERROR_TRANSACTION_SIGNATURE_VERIFICATION_FAILURE;
  exports.SOLANA_ERROR__JSON_RPC__SERVER_ERROR_UNSUPPORTED_TRANSACTION_VERSION = SOLANA_ERROR__JSON_RPC__SERVER_ERROR_UNSUPPORTED_TRANSACTION_VERSION;
  exports.SOLANA_ERROR__KEYS__INVALID_KEY_PAIR_BYTE_LENGTH = SOLANA_ERROR__KEYS__INVALID_KEY_PAIR_BYTE_LENGTH;
  exports.SOLANA_ERROR__KEYS__INVALID_PRIVATE_KEY_BYTE_LENGTH = SOLANA_ERROR__KEYS__INVALID_PRIVATE_KEY_BYTE_LENGTH;
  exports.SOLANA_ERROR__KEYS__INVALID_SIGNATURE_BYTE_LENGTH = SOLANA_ERROR__KEYS__INVALID_SIGNATURE_BYTE_LENGTH;
  exports.SOLANA_ERROR__KEYS__PUBLIC_KEY_MUST_MATCH_PRIVATE_KEY = SOLANA_ERROR__KEYS__PUBLIC_KEY_MUST_MATCH_PRIVATE_KEY;
  exports.SOLANA_ERROR__KEYS__SIGNATURE_STRING_LENGTH_OUT_OF_RANGE = SOLANA_ERROR__KEYS__SIGNATURE_STRING_LENGTH_OUT_OF_RANGE;
  exports.SOLANA_ERROR__LAMPORTS_OUT_OF_RANGE = SOLANA_ERROR__LAMPORTS_OUT_OF_RANGE;
  exports.SOLANA_ERROR__MALFORMED_BIGINT_STRING = SOLANA_ERROR__MALFORMED_BIGINT_STRING;
  exports.SOLANA_ERROR__MALFORMED_NUMBER_STRING = SOLANA_ERROR__MALFORMED_NUMBER_STRING;
  exports.SOLANA_ERROR__NONCE_ACCOUNT_NOT_FOUND = SOLANA_ERROR__NONCE_ACCOUNT_NOT_FOUND;
  exports.SOLANA_ERROR__RPC_SUBSCRIPTIONS__CANNOT_CREATE_SUBSCRIPTION_PLAN = SOLANA_ERROR__RPC_SUBSCRIPTIONS__CANNOT_CREATE_SUBSCRIPTION_PLAN;
  exports.SOLANA_ERROR__RPC_SUBSCRIPTIONS__CHANNEL_CLOSED_BEFORE_MESSAGE_BUFFERED = SOLANA_ERROR__RPC_SUBSCRIPTIONS__CHANNEL_CLOSED_BEFORE_MESSAGE_BUFFERED;
  exports.SOLANA_ERROR__RPC_SUBSCRIPTIONS__CHANNEL_CONNECTION_CLOSED = SOLANA_ERROR__RPC_SUBSCRIPTIONS__CHANNEL_CONNECTION_CLOSED;
  exports.SOLANA_ERROR__RPC_SUBSCRIPTIONS__CHANNEL_FAILED_TO_CONNECT = SOLANA_ERROR__RPC_SUBSCRIPTIONS__CHANNEL_FAILED_TO_CONNECT;
  exports.SOLANA_ERROR__RPC_SUBSCRIPTIONS__EXPECTED_SERVER_SUBSCRIPTION_ID = SOLANA_ERROR__RPC_SUBSCRIPTIONS__EXPECTED_SERVER_SUBSCRIPTION_ID;
  exports.SOLANA_ERROR__RPC__API_PLAN_MISSING_FOR_RPC_METHOD = SOLANA_ERROR__RPC__API_PLAN_MISSING_FOR_RPC_METHOD;
  exports.SOLANA_ERROR__RPC__INTEGER_OVERFLOW = SOLANA_ERROR__RPC__INTEGER_OVERFLOW;
  exports.SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR = SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR;
  exports.SOLANA_ERROR__RPC__TRANSPORT_HTTP_HEADER_FORBIDDEN = SOLANA_ERROR__RPC__TRANSPORT_HTTP_HEADER_FORBIDDEN;
  exports.SOLANA_ERROR__SIGNER__ADDRESS_CANNOT_HAVE_MULTIPLE_SIGNERS = SOLANA_ERROR__SIGNER__ADDRESS_CANNOT_HAVE_MULTIPLE_SIGNERS;
  exports.SOLANA_ERROR__SIGNER__EXPECTED_KEY_PAIR_SIGNER = SOLANA_ERROR__SIGNER__EXPECTED_KEY_PAIR_SIGNER;
  exports.SOLANA_ERROR__SIGNER__EXPECTED_MESSAGE_MODIFYING_SIGNER = SOLANA_ERROR__SIGNER__EXPECTED_MESSAGE_MODIFYING_SIGNER;
  exports.SOLANA_ERROR__SIGNER__EXPECTED_MESSAGE_PARTIAL_SIGNER = SOLANA_ERROR__SIGNER__EXPECTED_MESSAGE_PARTIAL_SIGNER;
  exports.SOLANA_ERROR__SIGNER__EXPECTED_MESSAGE_SIGNER = SOLANA_ERROR__SIGNER__EXPECTED_MESSAGE_SIGNER;
  exports.SOLANA_ERROR__SIGNER__EXPECTED_TRANSACTION_MODIFYING_SIGNER = SOLANA_ERROR__SIGNER__EXPECTED_TRANSACTION_MODIFYING_SIGNER;
  exports.SOLANA_ERROR__SIGNER__EXPECTED_TRANSACTION_PARTIAL_SIGNER = SOLANA_ERROR__SIGNER__EXPECTED_TRANSACTION_PARTIAL_SIGNER;
  exports.SOLANA_ERROR__SIGNER__EXPECTED_TRANSACTION_SENDING_SIGNER = SOLANA_ERROR__SIGNER__EXPECTED_TRANSACTION_SENDING_SIGNER;
  exports.SOLANA_ERROR__SIGNER__EXPECTED_TRANSACTION_SIGNER = SOLANA_ERROR__SIGNER__EXPECTED_TRANSACTION_SIGNER;
  exports.SOLANA_ERROR__SIGNER__TRANSACTION_CANNOT_HAVE_MULTIPLE_SENDING_SIGNERS = SOLANA_ERROR__SIGNER__TRANSACTION_CANNOT_HAVE_MULTIPLE_SENDING_SIGNERS;
  exports.SOLANA_ERROR__SIGNER__TRANSACTION_SENDING_SIGNER_MISSING = SOLANA_ERROR__SIGNER__TRANSACTION_SENDING_SIGNER_MISSING;
  exports.SOLANA_ERROR__SIGNER__WALLET_MULTISIGN_UNIMPLEMENTED = SOLANA_ERROR__SIGNER__WALLET_MULTISIGN_UNIMPLEMENTED;
  exports.SOLANA_ERROR__SUBTLE_CRYPTO__CANNOT_EXPORT_NON_EXTRACTABLE_KEY = SOLANA_ERROR__SUBTLE_CRYPTO__CANNOT_EXPORT_NON_EXTRACTABLE_KEY;
  exports.SOLANA_ERROR__SUBTLE_CRYPTO__DIGEST_UNIMPLEMENTED = SOLANA_ERROR__SUBTLE_CRYPTO__DIGEST_UNIMPLEMENTED;
  exports.SOLANA_ERROR__SUBTLE_CRYPTO__DISALLOWED_IN_INSECURE_CONTEXT = SOLANA_ERROR__SUBTLE_CRYPTO__DISALLOWED_IN_INSECURE_CONTEXT;
  exports.SOLANA_ERROR__SUBTLE_CRYPTO__ED25519_ALGORITHM_UNIMPLEMENTED = SOLANA_ERROR__SUBTLE_CRYPTO__ED25519_ALGORITHM_UNIMPLEMENTED;
  exports.SOLANA_ERROR__SUBTLE_CRYPTO__EXPORT_FUNCTION_UNIMPLEMENTED = SOLANA_ERROR__SUBTLE_CRYPTO__EXPORT_FUNCTION_UNIMPLEMENTED;
  exports.SOLANA_ERROR__SUBTLE_CRYPTO__GENERATE_FUNCTION_UNIMPLEMENTED = SOLANA_ERROR__SUBTLE_CRYPTO__GENERATE_FUNCTION_UNIMPLEMENTED;
  exports.SOLANA_ERROR__SUBTLE_CRYPTO__SIGN_FUNCTION_UNIMPLEMENTED = SOLANA_ERROR__SUBTLE_CRYPTO__SIGN_FUNCTION_UNIMPLEMENTED;
  exports.SOLANA_ERROR__SUBTLE_CRYPTO__VERIFY_FUNCTION_UNIMPLEMENTED = SOLANA_ERROR__SUBTLE_CRYPTO__VERIFY_FUNCTION_UNIMPLEMENTED;
  exports.SOLANA_ERROR__TIMESTAMP_OUT_OF_RANGE = SOLANA_ERROR__TIMESTAMP_OUT_OF_RANGE;
  exports.SOLANA_ERROR__TRANSACTION_ERROR__ACCOUNT_BORROW_OUTSTANDING = SOLANA_ERROR__TRANSACTION_ERROR__ACCOUNT_BORROW_OUTSTANDING;
  exports.SOLANA_ERROR__TRANSACTION_ERROR__ACCOUNT_IN_USE = SOLANA_ERROR__TRANSACTION_ERROR__ACCOUNT_IN_USE;
  exports.SOLANA_ERROR__TRANSACTION_ERROR__ACCOUNT_LOADED_TWICE = SOLANA_ERROR__TRANSACTION_ERROR__ACCOUNT_LOADED_TWICE;
  exports.SOLANA_ERROR__TRANSACTION_ERROR__ACCOUNT_NOT_FOUND = SOLANA_ERROR__TRANSACTION_ERROR__ACCOUNT_NOT_FOUND;
  exports.SOLANA_ERROR__TRANSACTION_ERROR__ADDRESS_LOOKUP_TABLE_NOT_FOUND = SOLANA_ERROR__TRANSACTION_ERROR__ADDRESS_LOOKUP_TABLE_NOT_FOUND;
  exports.SOLANA_ERROR__TRANSACTION_ERROR__ALREADY_PROCESSED = SOLANA_ERROR__TRANSACTION_ERROR__ALREADY_PROCESSED;
  exports.SOLANA_ERROR__TRANSACTION_ERROR__BLOCKHASH_NOT_FOUND = SOLANA_ERROR__TRANSACTION_ERROR__BLOCKHASH_NOT_FOUND;
  exports.SOLANA_ERROR__TRANSACTION_ERROR__CALL_CHAIN_TOO_DEEP = SOLANA_ERROR__TRANSACTION_ERROR__CALL_CHAIN_TOO_DEEP;
  exports.SOLANA_ERROR__TRANSACTION_ERROR__CLUSTER_MAINTENANCE = SOLANA_ERROR__TRANSACTION_ERROR__CLUSTER_MAINTENANCE;
  exports.SOLANA_ERROR__TRANSACTION_ERROR__DUPLICATE_INSTRUCTION = SOLANA_ERROR__TRANSACTION_ERROR__DUPLICATE_INSTRUCTION;
  exports.SOLANA_ERROR__TRANSACTION_ERROR__INSUFFICIENT_FUNDS_FOR_FEE = SOLANA_ERROR__TRANSACTION_ERROR__INSUFFICIENT_FUNDS_FOR_FEE;
  exports.SOLANA_ERROR__TRANSACTION_ERROR__INSUFFICIENT_FUNDS_FOR_RENT = SOLANA_ERROR__TRANSACTION_ERROR__INSUFFICIENT_FUNDS_FOR_RENT;
  exports.SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ACCOUNT_FOR_FEE = SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ACCOUNT_FOR_FEE;
  exports.SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ACCOUNT_INDEX = SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ACCOUNT_INDEX;
  exports.SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ADDRESS_LOOKUP_TABLE_DATA = SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ADDRESS_LOOKUP_TABLE_DATA;
  exports.SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ADDRESS_LOOKUP_TABLE_INDEX = SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ADDRESS_LOOKUP_TABLE_INDEX;
  exports.SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ADDRESS_LOOKUP_TABLE_OWNER = SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ADDRESS_LOOKUP_TABLE_OWNER;
  exports.SOLANA_ERROR__TRANSACTION_ERROR__INVALID_LOADED_ACCOUNTS_DATA_SIZE_LIMIT = SOLANA_ERROR__TRANSACTION_ERROR__INVALID_LOADED_ACCOUNTS_DATA_SIZE_LIMIT;
  exports.SOLANA_ERROR__TRANSACTION_ERROR__INVALID_PROGRAM_FOR_EXECUTION = SOLANA_ERROR__TRANSACTION_ERROR__INVALID_PROGRAM_FOR_EXECUTION;
  exports.SOLANA_ERROR__TRANSACTION_ERROR__INVALID_RENT_PAYING_ACCOUNT = SOLANA_ERROR__TRANSACTION_ERROR__INVALID_RENT_PAYING_ACCOUNT;
  exports.SOLANA_ERROR__TRANSACTION_ERROR__INVALID_WRITABLE_ACCOUNT = SOLANA_ERROR__TRANSACTION_ERROR__INVALID_WRITABLE_ACCOUNT;
  exports.SOLANA_ERROR__TRANSACTION_ERROR__MAX_LOADED_ACCOUNTS_DATA_SIZE_EXCEEDED = SOLANA_ERROR__TRANSACTION_ERROR__MAX_LOADED_ACCOUNTS_DATA_SIZE_EXCEEDED;
  exports.SOLANA_ERROR__TRANSACTION_ERROR__MISSING_SIGNATURE_FOR_FEE = SOLANA_ERROR__TRANSACTION_ERROR__MISSING_SIGNATURE_FOR_FEE;
  exports.SOLANA_ERROR__TRANSACTION_ERROR__PROGRAM_ACCOUNT_NOT_FOUND = SOLANA_ERROR__TRANSACTION_ERROR__PROGRAM_ACCOUNT_NOT_FOUND;
  exports.SOLANA_ERROR__TRANSACTION_ERROR__PROGRAM_EXECUTION_TEMPORARILY_RESTRICTED = SOLANA_ERROR__TRANSACTION_ERROR__PROGRAM_EXECUTION_TEMPORARILY_RESTRICTED;
  exports.SOLANA_ERROR__TRANSACTION_ERROR__RESANITIZATION_NEEDED = SOLANA_ERROR__TRANSACTION_ERROR__RESANITIZATION_NEEDED;
  exports.SOLANA_ERROR__TRANSACTION_ERROR__SANITIZE_FAILURE = SOLANA_ERROR__TRANSACTION_ERROR__SANITIZE_FAILURE;
  exports.SOLANA_ERROR__TRANSACTION_ERROR__SIGNATURE_FAILURE = SOLANA_ERROR__TRANSACTION_ERROR__SIGNATURE_FAILURE;
  exports.SOLANA_ERROR__TRANSACTION_ERROR__TOO_MANY_ACCOUNT_LOCKS = SOLANA_ERROR__TRANSACTION_ERROR__TOO_MANY_ACCOUNT_LOCKS;
  exports.SOLANA_ERROR__TRANSACTION_ERROR__UNBALANCED_TRANSACTION = SOLANA_ERROR__TRANSACTION_ERROR__UNBALANCED_TRANSACTION;
  exports.SOLANA_ERROR__TRANSACTION_ERROR__UNKNOWN = SOLANA_ERROR__TRANSACTION_ERROR__UNKNOWN;
  exports.SOLANA_ERROR__TRANSACTION_ERROR__UNSUPPORTED_VERSION = SOLANA_ERROR__TRANSACTION_ERROR__UNSUPPORTED_VERSION;
  exports.SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_ACCOUNT_DATA_BLOCK_LIMIT = SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_ACCOUNT_DATA_BLOCK_LIMIT;
  exports.SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_ACCOUNT_DATA_TOTAL_LIMIT = SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_ACCOUNT_DATA_TOTAL_LIMIT;
  exports.SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_MAX_ACCOUNT_COST_LIMIT = SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_MAX_ACCOUNT_COST_LIMIT;
  exports.SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_MAX_BLOCK_COST_LIMIT = SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_MAX_BLOCK_COST_LIMIT;
  exports.SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_MAX_VOTE_COST_LIMIT = SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_MAX_VOTE_COST_LIMIT;
  exports.SOLANA_ERROR__TRANSACTION__ADDRESSES_CANNOT_SIGN_TRANSACTION = SOLANA_ERROR__TRANSACTION__ADDRESSES_CANNOT_SIGN_TRANSACTION;
  exports.SOLANA_ERROR__TRANSACTION__ADDRESS_MISSING = SOLANA_ERROR__TRANSACTION__ADDRESS_MISSING;
  exports.SOLANA_ERROR__TRANSACTION__CANNOT_ENCODE_WITH_EMPTY_SIGNATURES = SOLANA_ERROR__TRANSACTION__CANNOT_ENCODE_WITH_EMPTY_SIGNATURES;
  exports.SOLANA_ERROR__TRANSACTION__EXPECTED_BLOCKHASH_LIFETIME = SOLANA_ERROR__TRANSACTION__EXPECTED_BLOCKHASH_LIFETIME;
  exports.SOLANA_ERROR__TRANSACTION__EXPECTED_NONCE_LIFETIME = SOLANA_ERROR__TRANSACTION__EXPECTED_NONCE_LIFETIME;
  exports.SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_ADDRESS_LOOKUP_TABLE_CONTENTS_MISSING = SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_ADDRESS_LOOKUP_TABLE_CONTENTS_MISSING;
  exports.SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_ADDRESS_LOOKUP_TABLE_INDEX_OUT_OF_RANGE = SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_ADDRESS_LOOKUP_TABLE_INDEX_OUT_OF_RANGE;
  exports.SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_FEE_PAYER_MISSING = SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_FEE_PAYER_MISSING;
  exports.SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_INSTRUCTION_PROGRAM_ADDRESS_NOT_FOUND = SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_INSTRUCTION_PROGRAM_ADDRESS_NOT_FOUND;
  exports.SOLANA_ERROR__TRANSACTION__FAILED_TO_ESTIMATE_COMPUTE_LIMIT = SOLANA_ERROR__TRANSACTION__FAILED_TO_ESTIMATE_COMPUTE_LIMIT;
  exports.SOLANA_ERROR__TRANSACTION__FAILED_WHEN_SIMULATING_TO_ESTIMATE_COMPUTE_LIMIT = SOLANA_ERROR__TRANSACTION__FAILED_WHEN_SIMULATING_TO_ESTIMATE_COMPUTE_LIMIT;
  exports.SOLANA_ERROR__TRANSACTION__FEE_PAYER_MISSING = SOLANA_ERROR__TRANSACTION__FEE_PAYER_MISSING;
  exports.SOLANA_ERROR__TRANSACTION__FEE_PAYER_SIGNATURE_MISSING = SOLANA_ERROR__TRANSACTION__FEE_PAYER_SIGNATURE_MISSING;
  exports.SOLANA_ERROR__TRANSACTION__INVALID_NONCE_TRANSACTION_FIRST_INSTRUCTION_MUST_BE_ADVANCE_NONCE = SOLANA_ERROR__TRANSACTION__INVALID_NONCE_TRANSACTION_FIRST_INSTRUCTION_MUST_BE_ADVANCE_NONCE;
  exports.SOLANA_ERROR__TRANSACTION__INVALID_NONCE_TRANSACTION_INSTRUCTIONS_MISSING = SOLANA_ERROR__TRANSACTION__INVALID_NONCE_TRANSACTION_INSTRUCTIONS_MISSING;
  exports.SOLANA_ERROR__TRANSACTION__INVOKED_PROGRAMS_CANNOT_PAY_FEES = SOLANA_ERROR__TRANSACTION__INVOKED_PROGRAMS_CANNOT_PAY_FEES;
  exports.SOLANA_ERROR__TRANSACTION__INVOKED_PROGRAMS_MUST_NOT_BE_WRITABLE = SOLANA_ERROR__TRANSACTION__INVOKED_PROGRAMS_MUST_NOT_BE_WRITABLE;
  exports.SOLANA_ERROR__TRANSACTION__MESSAGE_SIGNATURES_MISMATCH = SOLANA_ERROR__TRANSACTION__MESSAGE_SIGNATURES_MISMATCH;
  exports.SOLANA_ERROR__TRANSACTION__SIGNATURES_MISSING = SOLANA_ERROR__TRANSACTION__SIGNATURES_MISSING;
  exports.SOLANA_ERROR__TRANSACTION__VERSION_NUMBER_OUT_OF_RANGE = SOLANA_ERROR__TRANSACTION__VERSION_NUMBER_OUT_OF_RANGE;
  exports.SolanaError = SolanaError;
  exports.addCodecSentinel = addCodecSentinel;
  exports.addCodecSizePrefix = addCodecSizePrefix;
  exports.addDecoderSentinel = addDecoderSentinel;
  exports.addDecoderSizePrefix = addDecoderSizePrefix;
  exports.addEncoderSentinel = addEncoderSentinel;
  exports.addEncoderSizePrefix = addEncoderSizePrefix;
  exports.addSignersToInstruction = addSignersToInstruction;
  exports.addSignersToTransactionMessage = addSignersToTransactionMessage;
  exports.address = address;
  exports.appendTransactionMessageInstruction = appendTransactionMessageInstruction;
  exports.appendTransactionMessageInstructions = appendTransactionMessageInstructions;
  exports.assertAccountDecoded = assertAccountDecoded;
  exports.assertAccountExists = assertAccountExists;
  exports.assertAccountsDecoded = assertAccountsDecoded;
  exports.assertAccountsExist = assertAccountsExist;
  exports.assertByteArrayHasEnoughBytesForCodec = assertByteArrayHasEnoughBytesForCodec;
  exports.assertByteArrayIsNotEmptyForCodec = assertByteArrayIsNotEmptyForCodec;
  exports.assertByteArrayOffsetIsNotOutOfRange = assertByteArrayOffsetIsNotOutOfRange;
  exports.assertIsAddress = assertIsAddress;
  exports.assertIsBlockhash = assertIsBlockhash;
  exports.assertIsDurableNonceTransactionMessage = assertIsDurableNonceTransactionMessage;
  exports.assertIsFixedSize = assertIsFixedSize;
  exports.assertIsInstructionForProgram = assertIsInstructionForProgram;
  exports.assertIsInstructionWithAccounts = assertIsInstructionWithAccounts;
  exports.assertIsInstructionWithData = assertIsInstructionWithData;
  exports.assertIsKeyPairSigner = assertIsKeyPairSigner;
  exports.assertIsLamports = assertIsLamports;
  exports.assertIsMessageModifyingSigner = assertIsMessageModifyingSigner;
  exports.assertIsMessagePartialSigner = assertIsMessagePartialSigner;
  exports.assertIsMessageSigner = assertIsMessageSigner;
  exports.assertIsProgramDerivedAddress = assertIsProgramDerivedAddress;
  exports.assertIsSignature = assertIsSignature;
  exports.assertIsStringifiedBigInt = assertIsStringifiedBigInt;
  exports.assertIsStringifiedNumber = assertIsStringifiedNumber;
  exports.assertIsTransactionMessageWithBlockhashLifetime = assertIsTransactionMessageWithBlockhashLifetime;
  exports.assertIsTransactionMessageWithSingleSendingSigner = assertIsTransactionMessageWithSingleSendingSigner;
  exports.assertIsTransactionModifyingSigner = assertIsTransactionModifyingSigner;
  exports.assertIsTransactionPartialSigner = assertIsTransactionPartialSigner;
  exports.assertIsTransactionSendingSigner = assertIsTransactionSendingSigner;
  exports.assertIsTransactionSigner = assertIsTransactionSigner;
  exports.assertIsUnixTimestamp = assertIsUnixTimestamp;
  exports.assertIsVariableSize = assertIsVariableSize;
  exports.assertNumberIsBetweenForCodec = assertNumberIsBetweenForCodec;
  exports.assertTransactionIsFullySigned = assertTransactionIsFullySigned;
  exports.assertValidBaseString = assertValidBaseString;
  exports.assertValidNumberOfItemsForCodec = assertValidNumberOfItemsForCodec;
  exports.blockhash = blockhash;
  exports.combineCodec = combineCodec;
  exports.commitmentComparator = commitmentComparator;
  exports.compileTransaction = compileTransaction;
  exports.compileTransactionMessage = compileTransactionMessage;
  exports.compressTransactionMessageUsingAddressLookupTables = compressTransactionMessageUsingAddressLookupTables;
  exports.containsBytes = containsBytes;
  exports.createAddressWithSeed = createAddressWithSeed;
  exports.createCodec = createCodec;
  exports.createDecoder = createDecoder;
  exports.createDefaultRpcTransport = createDefaultRpcTransport;
  exports.createEncoder = createEncoder;
  exports.createJsonRpcApi = createJsonRpcApi;
  exports.createKeyPairFromBytes = createKeyPairFromBytes;
  exports.createKeyPairFromPrivateKeyBytes = createKeyPairFromPrivateKeyBytes;
  exports.createKeyPairSignerFromBytes = createKeyPairSignerFromBytes;
  exports.createKeyPairSignerFromPrivateKeyBytes = createKeyPairSignerFromPrivateKeyBytes;
  exports.createNoopSigner = createNoopSigner;
  exports.createPrivateKeyFromBytes = createPrivateKeyFromBytes;
  exports.createRpc = createRpc;
  exports.createRpcMessage = createRpcMessage;
  exports.createSignableMessage = createSignableMessage;
  exports.createSignerFromKeyPair = createSignerFromKeyPair;
  exports.createSolanaRpc = createSolanaRpc;
  exports.createSolanaRpcApi = createSolanaRpcApi;
  exports.createSolanaRpcFromTransport = createSolanaRpcFromTransport;
  exports.createTransactionMessage = createTransactionMessage;
  exports.decodeAccount = decodeAccount;
  exports.decompileTransactionMessage = decompileTransactionMessage;
  exports.decompileTransactionMessageFetchingLookupTables = decompileTransactionMessageFetchingLookupTables;
  exports.devnet = devnet;
  exports.downgradeRoleToNonSigner = downgradeRoleToNonSigner;
  exports.downgradeRoleToReadonly = downgradeRoleToReadonly;
  exports.fetchEncodedAccount = fetchEncodedAccount;
  exports.fetchEncodedAccounts = fetchEncodedAccounts;
  exports.fetchJsonParsedAccount = fetchJsonParsedAccount;
  exports.fetchJsonParsedAccounts = fetchJsonParsedAccounts;
  exports.fixBytes = fixBytes;
  exports.fixCodecSize = fixCodecSize;
  exports.fixDecoderSize = fixDecoderSize;
  exports.fixEncoderSize = fixEncoderSize;
  exports.generateKeyPair = generateKeyPair;
  exports.generateKeyPairSigner = generateKeyPairSigner;
  exports.getAddressCodec = getAddressCodec;
  exports.getAddressComparator = getAddressComparator;
  exports.getAddressDecoder = getAddressDecoder;
  exports.getAddressEncoder = getAddressEncoder;
  exports.getAddressFromPublicKey = getAddressFromPublicKey;
  exports.getArrayCodec = getArrayCodec;
  exports.getArrayDecoder = getArrayDecoder;
  exports.getArrayEncoder = getArrayEncoder;
  exports.getBase10Codec = getBase10Codec;
  exports.getBase10Decoder = getBase10Decoder;
  exports.getBase10Encoder = getBase10Encoder;
  exports.getBase16Codec = getBase16Codec;
  exports.getBase16Decoder = getBase16Decoder;
  exports.getBase16Encoder = getBase16Encoder;
  exports.getBase58Codec = getBase58Codec;
  exports.getBase58Decoder = getBase58Decoder;
  exports.getBase58Encoder = getBase58Encoder;
  exports.getBase64Codec = getBase64Codec;
  exports.getBase64Decoder = getBase64Decoder;
  exports.getBase64EncodedWireTransaction = getBase64EncodedWireTransaction;
  exports.getBase64Encoder = getBase64Encoder;
  exports.getBaseXCodec = getBaseXCodec;
  exports.getBaseXDecoder = getBaseXDecoder;
  exports.getBaseXEncoder = getBaseXEncoder;
  exports.getBaseXResliceCodec = getBaseXResliceCodec;
  exports.getBaseXResliceDecoder = getBaseXResliceDecoder;
  exports.getBaseXResliceEncoder = getBaseXResliceEncoder;
  exports.getBitArrayCodec = getBitArrayCodec;
  exports.getBitArrayDecoder = getBitArrayDecoder;
  exports.getBitArrayEncoder = getBitArrayEncoder;
  exports.getBlockhashCodec = getBlockhashCodec;
  exports.getBlockhashComparator = getBlockhashComparator;
  exports.getBlockhashDecoder = getBlockhashDecoder;
  exports.getBlockhashEncoder = getBlockhashEncoder;
  exports.getBooleanCodec = getBooleanCodec;
  exports.getBooleanDecoder = getBooleanDecoder;
  exports.getBooleanEncoder = getBooleanEncoder;
  exports.getBytesCodec = getBytesCodec;
  exports.getBytesDecoder = getBytesDecoder;
  exports.getBytesEncoder = getBytesEncoder;
  exports.getCompiledTransactionMessageCodec = getCompiledTransactionMessageCodec;
  exports.getCompiledTransactionMessageDecoder = getCompiledTransactionMessageDecoder;
  exports.getCompiledTransactionMessageEncoder = getCompiledTransactionMessageEncoder;
  exports.getComputeUnitEstimateForTransactionMessageFactory = getComputeUnitEstimateForTransactionMessageFactory;
  exports.getConstantCodec = getConstantCodec;
  exports.getConstantDecoder = getConstantDecoder;
  exports.getConstantEncoder = getConstantEncoder;
  exports.getDataEnumCodec = getDataEnumCodec;
  exports.getDataEnumDecoder = getDataEnumDecoder;
  exports.getDataEnumEncoder = getDataEnumEncoder;
  exports.getDefaultLamportsCodec = getDefaultLamportsCodec;
  exports.getDefaultLamportsDecoder = getDefaultLamportsDecoder;
  exports.getDefaultLamportsEncoder = getDefaultLamportsEncoder;
  exports.getDiscriminatedUnionCodec = getDiscriminatedUnionCodec;
  exports.getDiscriminatedUnionDecoder = getDiscriminatedUnionDecoder;
  exports.getDiscriminatedUnionEncoder = getDiscriminatedUnionEncoder;
  exports.getEncodedSize = getEncodedSize;
  exports.getEnumCodec = getEnumCodec;
  exports.getEnumDecoder = getEnumDecoder;
  exports.getEnumEncoder = getEnumEncoder;
  exports.getF32Codec = getF32Codec;
  exports.getF32Decoder = getF32Decoder;
  exports.getF32Encoder = getF32Encoder;
  exports.getF64Codec = getF64Codec;
  exports.getF64Decoder = getF64Decoder;
  exports.getF64Encoder = getF64Encoder;
  exports.getHiddenPrefixCodec = getHiddenPrefixCodec;
  exports.getHiddenPrefixDecoder = getHiddenPrefixDecoder;
  exports.getHiddenPrefixEncoder = getHiddenPrefixEncoder;
  exports.getHiddenSuffixCodec = getHiddenSuffixCodec;
  exports.getHiddenSuffixDecoder = getHiddenSuffixDecoder;
  exports.getHiddenSuffixEncoder = getHiddenSuffixEncoder;
  exports.getI128Codec = getI128Codec;
  exports.getI128Decoder = getI128Decoder;
  exports.getI128Encoder = getI128Encoder;
  exports.getI16Codec = getI16Codec;
  exports.getI16Decoder = getI16Decoder;
  exports.getI16Encoder = getI16Encoder;
  exports.getI32Codec = getI32Codec;
  exports.getI32Decoder = getI32Decoder;
  exports.getI32Encoder = getI32Encoder;
  exports.getI64Codec = getI64Codec;
  exports.getI64Decoder = getI64Decoder;
  exports.getI64Encoder = getI64Encoder;
  exports.getI8Codec = getI8Codec;
  exports.getI8Decoder = getI8Decoder;
  exports.getI8Encoder = getI8Encoder;
  exports.getLamportsCodec = getLamportsCodec;
  exports.getLamportsDecoder = getLamportsDecoder;
  exports.getLamportsEncoder = getLamportsEncoder;
  exports.getMapCodec = getMapCodec;
  exports.getMapDecoder = getMapDecoder;
  exports.getMapEncoder = getMapEncoder;
  exports.getNullableCodec = getNullableCodec;
  exports.getNullableDecoder = getNullableDecoder;
  exports.getNullableEncoder = getNullableEncoder;
  exports.getOptionCodec = getOptionCodec;
  exports.getOptionDecoder = getOptionDecoder;
  exports.getOptionEncoder = getOptionEncoder;
  exports.getProgramDerivedAddress = getProgramDerivedAddress;
  exports.getPublicKeyFromPrivateKey = getPublicKeyFromPrivateKey;
  exports.getScalarEnumCodec = getScalarEnumCodec;
  exports.getScalarEnumDecoder = getScalarEnumDecoder;
  exports.getScalarEnumEncoder = getScalarEnumEncoder;
  exports.getSetCodec = getSetCodec;
  exports.getSetDecoder = getSetDecoder;
  exports.getSetEncoder = getSetEncoder;
  exports.getShortU16Codec = getShortU16Codec;
  exports.getShortU16Decoder = getShortU16Decoder;
  exports.getShortU16Encoder = getShortU16Encoder;
  exports.getSignatureFromTransaction = getSignatureFromTransaction;
  exports.getSignersFromInstruction = getSignersFromInstruction;
  exports.getSignersFromTransactionMessage = getSignersFromTransactionMessage;
  exports.getSolanaErrorFromInstructionError = getSolanaErrorFromInstructionError;
  exports.getSolanaErrorFromJsonRpcError = getSolanaErrorFromJsonRpcError;
  exports.getSolanaErrorFromTransactionError = getSolanaErrorFromTransactionError;
  exports.getStructCodec = getStructCodec;
  exports.getStructDecoder = getStructDecoder;
  exports.getStructEncoder = getStructEncoder;
  exports.getTransactionCodec = getTransactionCodec;
  exports.getTransactionDecoder = getTransactionDecoder;
  exports.getTransactionEncoder = getTransactionEncoder;
  exports.getTransactionVersionCodec = getTransactionVersionCodec;
  exports.getTransactionVersionDecoder = getTransactionVersionDecoder;
  exports.getTransactionVersionEncoder = getTransactionVersionEncoder;
  exports.getTupleCodec = getTupleCodec;
  exports.getTupleDecoder = getTupleDecoder;
  exports.getTupleEncoder = getTupleEncoder;
  exports.getU128Codec = getU128Codec;
  exports.getU128Decoder = getU128Decoder;
  exports.getU128Encoder = getU128Encoder;
  exports.getU16Codec = getU16Codec;
  exports.getU16Decoder = getU16Decoder;
  exports.getU16Encoder = getU16Encoder;
  exports.getU32Codec = getU32Codec;
  exports.getU32Decoder = getU32Decoder;
  exports.getU32Encoder = getU32Encoder;
  exports.getU64Codec = getU64Codec;
  exports.getU64Decoder = getU64Decoder;
  exports.getU64Encoder = getU64Encoder;
  exports.getU8Codec = getU8Codec;
  exports.getU8Decoder = getU8Decoder;
  exports.getU8Encoder = getU8Encoder;
  exports.getUnionCodec = getUnionCodec;
  exports.getUnionDecoder = getUnionDecoder;
  exports.getUnionEncoder = getUnionEncoder;
  exports.getUnitCodec = getUnitCodec;
  exports.getUnitDecoder = getUnitDecoder;
  exports.getUnitEncoder = getUnitEncoder;
  exports.getUtf8Codec = getUtf8Codec;
  exports.getUtf8Decoder = getUtf8Decoder;
  exports.getUtf8Encoder = getUtf8Encoder;
  exports.isAddress = isAddress;
  exports.isAdvanceNonceAccountInstruction = isAdvanceNonceAccountInstruction;
  exports.isBlockhash = isBlockhash;
  exports.isDurableNonceTransaction = isDurableNonceTransaction;
  exports.isFixedSize = isFixedSize;
  exports.isInstructionForProgram = isInstructionForProgram;
  exports.isInstructionWithAccounts = isInstructionWithAccounts;
  exports.isInstructionWithData = isInstructionWithData;
  exports.isJsonRpcPayload = isJsonRpcPayload;
  exports.isKeyPairSigner = isKeyPairSigner;
  exports.isLamports = isLamports;
  exports.isMessageModifyingSigner = isMessageModifyingSigner;
  exports.isMessagePartialSigner = isMessagePartialSigner;
  exports.isMessageSigner = isMessageSigner;
  exports.isNone = isNone;
  exports.isOption = isOption;
  exports.isProgramDerivedAddress = isProgramDerivedAddress;
  exports.isProgramError = isProgramError;
  exports.isSignature = isSignature;
  exports.isSignerRole = isSignerRole;
  exports.isSolanaError = isSolanaError;
  exports.isSome = isSome;
  exports.isStringifiedBigInt = isStringifiedBigInt;
  exports.isStringifiedNumber = isStringifiedNumber;
  exports.isTransactionMessageWithBlockhashLifetime = isTransactionMessageWithBlockhashLifetime;
  exports.isTransactionMessageWithSingleSendingSigner = isTransactionMessageWithSingleSendingSigner;
  exports.isTransactionModifyingSigner = isTransactionModifyingSigner;
  exports.isTransactionPartialSigner = isTransactionPartialSigner;
  exports.isTransactionSendingSigner = isTransactionSendingSigner;
  exports.isTransactionSigner = isTransactionSigner;
  exports.isUnixTimestamp = isUnixTimestamp;
  exports.isVariableSize = isVariableSize;
  exports.isWritableRole = isWritableRole;
  exports.lamports = lamports;
  exports.mainnet = mainnet;
  exports.mergeBytes = mergeBytes;
  exports.mergeRoles = mergeRoles;
  exports.none = none;
  exports.offsetCodec = offsetCodec;
  exports.offsetDecoder = offsetDecoder;
  exports.offsetEncoder = offsetEncoder;
  exports.padBytes = padBytes;
  exports.padLeftCodec = padLeftCodec;
  exports.padLeftDecoder = padLeftDecoder;
  exports.padLeftEncoder = padLeftEncoder;
  exports.padNullCharacters = padNullCharacters;
  exports.padRightCodec = padRightCodec;
  exports.padRightDecoder = padRightDecoder;
  exports.padRightEncoder = padRightEncoder;
  exports.parseBase58RpcAccount = parseBase58RpcAccount;
  exports.parseBase64RpcAccount = parseBase64RpcAccount;
  exports.parseJsonRpcAccount = parseJsonRpcAccount;
  exports.partiallySignTransaction = partiallySignTransaction;
  exports.partiallySignTransactionMessageWithSigners = partiallySignTransactionMessageWithSigners;
  exports.pipe = pipe;
  exports.prependTransactionMessageInstruction = prependTransactionMessageInstruction;
  exports.prependTransactionMessageInstructions = prependTransactionMessageInstructions;
  exports.removeNullCharacters = removeNullCharacters;
  exports.resizeCodec = resizeCodec;
  exports.resizeDecoder = resizeDecoder;
  exports.resizeEncoder = resizeEncoder;
  exports.reverseCodec = reverseCodec;
  exports.reverseDecoder = reverseDecoder;
  exports.reverseEncoder = reverseEncoder;
  exports.safeCaptureStackTrace = safeCaptureStackTrace;
  exports.sendTransactionWithoutConfirmingFactory = sendTransactionWithoutConfirmingFactory;
  exports.setTransactionMessageFeePayer = setTransactionMessageFeePayer;
  exports.setTransactionMessageFeePayerSigner = setTransactionMessageFeePayerSigner;
  exports.setTransactionMessageLifetimeUsingBlockhash = setTransactionMessageLifetimeUsingBlockhash;
  exports.setTransactionMessageLifetimeUsingDurableNonce = setTransactionMessageLifetimeUsingDurableNonce;
  exports.signAndSendTransactionMessageWithSigners = signAndSendTransactionMessageWithSigners;
  exports.signBytes = signBytes;
  exports.signTransaction = signTransaction;
  exports.signTransactionMessageWithSigners = signTransactionMessageWithSigners;
  exports.signature = signature;
  exports.some = some;
  exports.stringifiedBigInt = stringifiedBigInt;
  exports.stringifiedNumber = stringifiedNumber;
  exports.testnet = testnet;
  exports.transformCodec = transformCodec;
  exports.transformDecoder = transformDecoder;
  exports.transformEncoder = transformEncoder;
  exports.unixTimestamp = unixTimestamp;
  exports.unwrapOption = unwrapOption;
  exports.unwrapOptionRecursively = unwrapOptionRecursively;
  exports.upgradeRoleToSigner = upgradeRoleToSigner;
  exports.upgradeRoleToWritable = upgradeRoleToWritable;
  exports.verifySignature = verifySignature;
  exports.wrapNullable = wrapNullable;
  exports.Buffer = Buffer;

  return exports;

})
//# sourceMappingURL=index.development.js.map
//# sourceMappingURL=index.development.js.map