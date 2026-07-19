"use server";
import { staffLoginAction, logoutAction as logout } from "@/server/auth/actions";
export async function loginAction(formData: FormData){return staffLoginAction(formData)}
export async function logoutAction(){return logout()}
