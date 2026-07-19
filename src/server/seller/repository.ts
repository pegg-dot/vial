import { getSellerContext } from "./ops";

export async function getSellerWorkspace(email: string) {
  return getSellerContext(email);
}
