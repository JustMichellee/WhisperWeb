import type { ConversationMemberDto } from '@chat/shared';
import { decryptString, encryptString } from './cipher';
import {
  deriveConversationKey,
  generateRandomAesKey,
  importAesKeyFromBase64,
} from './keys';

const GROUP_WRAP_CONTEXT = 'whisperweb-group-key-wrap-v1';

export interface WrappedMemberKey {
  userId: string;
  encryptedGroupKey: string;
  groupKeyIv: string;
  keySenderPublicKey: string;
}

export async function wrapGroupKeyForMembers(
  myPrivateKey: CryptoKey,
  myPublicKeyBase64: string,
  groupKeyBase64: string,
  members: Array<{ userId: string; publicKey: string }>
): Promise<WrappedMemberKey[]> {
  return Promise.all(
    members.map(async (member) => {
      const pairKey = await deriveConversationKey(myPrivateKey, member.publicKey, GROUP_WRAP_CONTEXT);
      const wrapped = await encryptString(pairKey, groupKeyBase64);
      return {
        userId: member.userId,
        encryptedGroupKey: wrapped.ciphertext,
        groupKeyIv: wrapped.iv,
        keySenderPublicKey: myPublicKeyBase64,
      };
    })
  );
}

export async function createAndWrapNewGroupKey(
  myPrivateKey: CryptoKey,
  myPublicKeyBase64: string,
  members: Array<{ userId: string; publicKey: string }>
): Promise<{ groupKey: CryptoKey; groupKeyBase64: string; wrappedMembers: WrappedMemberKey[] }> {
  const { key, rawBase64 } = await generateRandomAesKey();
  const wrappedMembers = await wrapGroupKeyForMembers(myPrivateKey, myPublicKeyBase64, rawBase64, members);
  return { groupKey: key, groupKeyBase64: rawBase64, wrappedMembers };
}

export async function unwrapMyGroupKey(
  myPrivateKey: CryptoKey,
  myMembership: ConversationMemberDto
): Promise<{ key: CryptoKey; rawBase64: string } | null> {
  if (!myMembership.encryptedGroupKey || !myMembership.groupKeyIv || !myMembership.keySenderPublicKey) {
    return null;
  }

  const pairKey = await deriveConversationKey(
    myPrivateKey,
    myMembership.keySenderPublicKey,
    GROUP_WRAP_CONTEXT
  );
  const rawBase64 = await decryptString(pairKey, myMembership.encryptedGroupKey, myMembership.groupKeyIv);
  const key = await importAesKeyFromBase64(rawBase64);
  return { key, rawBase64 };
}

