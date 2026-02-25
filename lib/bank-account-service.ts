import { createClient } from "@/lib/supabase/client"

export type BankAccount = {
  id: string
  user_id: string
  bank_name: string
  bank_branch: string | null
  bank_country: string | null
  bank_type: string | null
  account_name: string
  account_number: string
  iban: string | null
  swift_code: string | null
  routing_number: string | null
  currency_code: string
  is_primary: boolean
  status: string
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type BankAccountFormData = {
  bank_name: string
  bank_branch: string
  bank_country: string
  bank_type: string
  account_name: string
  account_number: string
  iban: string
  swift_code: string
  routing_number: string
  currency_code: string
  is_primary: boolean
}

export async function fetchBankAccounts(userId: string): Promise<{ data: BankAccount[] | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("user_bank_accounts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) return { data: null, error: error.message }
  return { data: data as BankAccount[], error: null }
}

export async function addBankAccount(
  userId: string,
  formData: BankAccountFormData,
): Promise<{ data: BankAccount | null; error: string | null }> {
  const supabase = createClient()

  // If setting as primary, clear all others first
  if (formData.is_primary) {
    await supabase
      .from("user_bank_accounts")
      .update({ is_primary: false })
      .eq("user_id", userId)
  }

  const { data, error } = await supabase
    .from("user_bank_accounts")
    .insert({
      user_id:        userId,
      bank_name:      formData.bank_name.trim(),
      bank_branch:    formData.bank_branch.trim() || null,
      bank_country:   formData.bank_country || null,
      bank_type:      formData.bank_type || null,
      account_name:   formData.account_name.trim(),
      account_number: formData.account_number.trim(),
      iban:           formData.iban.trim() || null,
      swift_code:     formData.swift_code.trim() || null,
      routing_number: formData.routing_number.trim() || null,
      currency_code:  formData.currency_code,
      is_primary:     formData.is_primary,
      status:         "active",
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as BankAccount, error: null }
}

export async function updateBankAccount(
  accountId: string,
  userId: string,
  formData: BankAccountFormData,
): Promise<{ data: BankAccount | null; error: string | null }> {
  const supabase = createClient()

  if (formData.is_primary) {
    await supabase
      .from("user_bank_accounts")
      .update({ is_primary: false })
      .eq("user_id", userId)
  }

  const { data, error } = await supabase
    .from("user_bank_accounts")
    .update({
      bank_name:      formData.bank_name.trim(),
      bank_branch:    formData.bank_branch.trim() || null,
      bank_country:   formData.bank_country || null,
      bank_type:      formData.bank_type || null,
      account_name:   formData.account_name.trim(),
      account_number: formData.account_number.trim(),
      iban:           formData.iban.trim() || null,
      swift_code:     formData.swift_code.trim() || null,
      routing_number: formData.routing_number.trim() || null,
      currency_code:  formData.currency_code,
      is_primary:     formData.is_primary,
    })
    .eq("id", accountId)
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as BankAccount, error: null }
}

export async function setPrimaryBankAccount(
  accountId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const supabase = createClient()

  const { error: clearError } = await supabase
    .from("user_bank_accounts")
    .update({ is_primary: false })
    .eq("user_id", userId)

  if (clearError) return { error: clearError.message }

  const { error } = await supabase
    .from("user_bank_accounts")
    .update({ is_primary: true })
    .eq("id", accountId)

  if (error) return { error: error.message }
  return { error: null }
}

export async function toggleBankAccountStatus(
  accountId: string,
  currentStatus: string,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const nextStatus = currentStatus === "active" ? "inactive" : "active"

  const { error } = await supabase
    .from("user_bank_accounts")
    .update({ status: nextStatus })
    .eq("id", accountId)

  if (error) return { error: error.message }
  return { error: null }
}

export async function deleteBankAccount(accountId: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("user_bank_accounts")
    .delete()
    .eq("id", accountId)

  if (error) return { error: error.message }
  return { error: null }
}
