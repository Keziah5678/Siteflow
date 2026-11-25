
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "admin_audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"details": Json | null,"id": string,"target_id": string | null,"target_type": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"details"?: Json | null,"id"?: string,"target_id"?: string | null,"target_type"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"details"?: Json | null,"id"?: string,"target_id"?: string | null,"target_type"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "admin_audit_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_usage": {
                  Row: {
                    "created_at": string,"credits": number,"feature": string,"id": string,"input_tokens": number,"model": string | null,"output_tokens": number,"provider": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"credits"?: number,"feature": string,"id"?: string,"input_tokens"?: number,"model"?: string | null,"output_tokens"?: number,"provider"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"credits"?: number,"feature"?: string,"id"?: string,"input_tokens"?: number,"model"?: string | null,"output_tokens"?: number,"provider"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_usage_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"app_settings": {
                  Row: {
                    "key": string,"updated_at": string,"updated_by": string | null,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"updated_at"?: string,"updated_by"?: string | null,"value": NonNullable<Json>
                  }
                  Update: {
                    "key"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "app_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"applications": {
                  Row: {
                    "applicant_id": string,"created_at": string,"decided_at": string | null,"decided_by": string | null,"id": string,"message": string,"project_id": string,"skill": string | null,"status": Database["public"]['Enums']["application_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "applicant_id": string,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"id"?: string,"message": string,"project_id": string,"skill"?: string | null,"status"?: Database["public"]['Enums']["application_status"]
                  }
                  Update: {
                    "applicant_id"?: string,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"id"?: string,"message"?: string,"project_id"?: string,"skill"?: string | null,"status"?: Database["public"]['Enums']["application_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "applications_applicant_id_fkey"
      columns: ["applicant_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "applications_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "applications_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"blocks": {
                  Row: {
                    "blocked_id": string,"blocker_id": string,"created_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blocked_id": string,"blocker_id": string,"created_at"?: string
                  }
                  Update: {
                    "blocked_id"?: string,"blocker_id"?: string,"created_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "blocks_blocked_id_fkey"
      columns: ["blocked_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "blocks_blocker_id_fkey"
      columns: ["blocker_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"calendar_events": {
                  Row: {
                    "created_at": string,"created_by": string,"ends_at": string | null,"id": string,"location": string | null,"project_id": string,"starts_at": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"ends_at"?: string | null,"id"?: string,"location"?: string | null,"project_id": string,"starts_at": string,"title": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"ends_at"?: string | null,"id"?: string,"location"?: string | null,"project_id"?: string,"starts_at"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "calendar_events_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "calendar_events_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"comments": {
                  Row: {
                    "author_id": string,"body": string,"created_at": string,"id": string,"moderation": Database["public"]['Enums']["moderation_state"],"project_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body": string,"created_at"?: string,"id"?: string,"moderation"?: Database["public"]['Enums']["moderation_state"],"project_id": string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: string,"id"?: string,"moderation"?: Database["public"]['Enums']["moderation_state"],"project_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"contact_requests": {
                  Row: {
                    "conversation_id": string | null,"created_at": string,"from_id": string,"id": string,"message": string | null,"responded_at": string | null,"status": Database["public"]['Enums']["contact_status"],"to_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "conversation_id"?: string | null,"created_at"?: string,"from_id": string,"id"?: string,"message"?: string | null,"responded_at"?: string | null,"status"?: Database["public"]['Enums']["contact_status"],"to_id": string
                  }
                  Update: {
                    "conversation_id"?: string | null,"created_at"?: string,"from_id"?: string,"id"?: string,"message"?: string | null,"responded_at"?: string | null,"status"?: Database["public"]['Enums']["contact_status"],"to_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contact_requests_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contact_requests_from_id_fkey"
      columns: ["from_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contact_requests_to_id_fkey"
      columns: ["to_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"conversation_participants": {
                  Row: {
                    "conversation_id": string,"joined_at": string,"last_read_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "conversation_id": string,"joined_at"?: string,"last_read_at"?: string,"user_id": string
                  }
                  Update: {
                    "conversation_id"?: string,"joined_at"?: string,"last_read_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversation_participants_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversation_participants_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"conversations": {
                  Row: {
                    "created_at": string,"created_by": string | null,"direct_key": string | null,"id": string,"kind": Database["public"]['Enums']["conversation_kind"],"last_message_at": string,"project_id": string | null,"title": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"direct_key"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["conversation_kind"],"last_message_at"?: string,"project_id"?: string | null,"title"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"direct_key"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["conversation_kind"],"last_message_at"?: string,"project_id"?: string | null,"title"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversations_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_project_id_fkey"
      columns: ["project_id"]
isOneToOne: true
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"endorsements": {
                  Row: {
                    "author_id": string,"body": string,"created_at": string,"id": string,"project_id": string,"recipient_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body": string,"created_at"?: string,"id"?: string,"project_id": string,"recipient_id": string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: string,"id"?: string,"project_id"?: string,"recipient_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "endorsements_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "endorsements_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "endorsements_recipient_id_fkey"
      columns: ["recipient_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"event_details": {
                  Row: {
                    "capacity": number | null,"confirmed_date": string | null,"date_options": (string)[],"price_max_cents": number | null,"price_min_cents": number | null,"project_id": string,"stage": Database["public"]['Enums']["event_stage"],"updated_at": string,"venue_idea": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "capacity"?: number | null,"confirmed_date"?: string | null,"date_options"?: (string)[],"price_max_cents"?: number | null,"price_min_cents"?: number | null,"project_id": string,"stage"?: Database["public"]['Enums']["event_stage"],"updated_at"?: string,"venue_idea"?: string | null
                  }
                  Update: {
                    "capacity"?: number | null,"confirmed_date"?: string | null,"date_options"?: (string)[],"price_max_cents"?: number | null,"price_min_cents"?: number | null,"project_id"?: string,"stage"?: Database["public"]['Enums']["event_stage"],"updated_at"?: string,"venue_idea"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_details_project_id_fkey"
      columns: ["project_id"]
isOneToOne: true
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "attachment_name": string | null,"attachment_path": string | null,"body": string,"conversation_id": string,"created_at": string,"id": string,"sender_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attachment_name"?: string | null,"attachment_path"?: string | null,"body"?: string,"conversation_id": string,"created_at"?: string,"id"?: string,"sender_id": string
                  }
                  Update: {
                    "attachment_name"?: string | null,"attachment_path"?: string | null,"body"?: string,"conversation_id"?: string,"created_at"?: string,"id"?: string,"sender_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"milestones": {
                  Row: {
                    "created_at": string,"description": string | null,"done": boolean,"done_at": string | null,"done_by": string | null,"due_date": string | null,"id": string,"position": number,"project_id": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"done"?: boolean,"done_at"?: string | null,"done_by"?: string | null,"due_date"?: string | null,"id"?: string,"position"?: number,"project_id": string,"title": string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"done"?: boolean,"done_at"?: string | null,"done_by"?: string | null,"due_date"?: string | null,"id"?: string,"position"?: number,"project_id"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "milestones_done_by_fkey"
      columns: ["done_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "milestones_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "actor_id": string | null,"body": string | null,"created_at": string,"id": string,"link": string | null,"read_at": string | null,"title": string,"type": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"body"?: string | null,"created_at"?: string,"id"?: string,"link"?: string | null,"read_at"?: string | null,"title": string,"type": string,"user_id": string
                  }
                  Update: {
                    "actor_id"?: string | null,"body"?: string | null,"created_at"?: string,"id"?: string,"link"?: string | null,"read_at"?: string | null,"title"?: string,"type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"opportunities": {
                  Row: {
                    "city": string | null,"company_id": string,"compensation": string | null,"created_at": string,"description": string,"id": string,"is_open": boolean,"is_remote": boolean,"is_sponsored": boolean,"kind": Database["public"]['Enums']["opportunity_kind"],"moderation": Database["public"]['Enums']["moderation_state"],"related_project_id": string | null,"skills": (string)[],"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "city"?: string | null,"company_id": string,"compensation"?: string | null,"created_at"?: string,"description": string,"id"?: string,"is_open"?: boolean,"is_remote"?: boolean,"is_sponsored"?: boolean,"kind": Database["public"]['Enums']["opportunity_kind"],"moderation"?: Database["public"]['Enums']["moderation_state"],"related_project_id"?: string | null,"skills"?: (string)[],"title": string
                  }
                  Update: {
                    "city"?: string | null,"company_id"?: string,"compensation"?: string | null,"created_at"?: string,"description"?: string,"id"?: string,"is_open"?: boolean,"is_remote"?: boolean,"is_sponsored"?: boolean,"kind"?: Database["public"]['Enums']["opportunity_kind"],"moderation"?: Database["public"]['Enums']["moderation_state"],"related_project_id"?: string | null,"skills"?: (string)[],"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "opportunities_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "opportunities_related_project_id_fkey"
      columns: ["related_project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"opportunity_responses": {
                  Row: {
                    "created_at": string,"id": string,"message": string,"opportunity_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"message": string,"opportunity_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"message"?: string,"opportunity_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "opportunity_responses_opportunity_id_fkey"
      columns: ["opportunity_id"]
isOneToOne: false
      referencedRelation: "opportunities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "opportunity_responses_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"organizer_proposals": {
                  Row: {
                    "created_at": string,"id": string,"message": string,"organizer_id": string,"project_id": string,"proposed_date": string | null,"proposed_price_cents": number | null,"proposed_venue": string | null,"status": Database["public"]['Enums']["proposal_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"message": string,"organizer_id": string,"project_id": string,"proposed_date"?: string | null,"proposed_price_cents"?: number | null,"proposed_venue"?: string | null,"status"?: Database["public"]['Enums']["proposal_status"]
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"message"?: string,"organizer_id"?: string,"project_id"?: string,"proposed_date"?: string | null,"proposed_price_cents"?: number | null,"proposed_venue"?: string | null,"status"?: Database["public"]['Enums']["proposal_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "organizer_proposals_organizer_id_fkey"
      columns: ["organizer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "organizer_proposals_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount_cents": number,"created_at": string,"currency": string,"id": string,"kind": string,"status": string,"stripe_session_id": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"created_at"?: string,"currency": string,"id"?: string,"kind": string,"status": string,"stripe_session_id"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "amount_cents"?: number,"created_at"?: string,"currency"?: string,"id"?: string,"kind"?: string,"status"?: string,"stripe_session_id"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"plan_settings": {
                  Row: {
                    "ai_monthly_credits": number,"currency": string,"features": (string)[],"label": string,"plan": Database["public"]['Enums']["plan_tier"],"price_cents": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_monthly_credits": number,"currency"?: string,"features"?: (string)[],"label": string,"plan": Database["public"]['Enums']["plan_tier"],"price_cents": number,"updated_at"?: string
                  }
                  Update: {
                    "ai_monthly_credits"?: number,"currency"?: string,"features"?: (string)[],"label"?: string,"plan"?: Database["public"]['Enums']["plan_tier"],"price_cents"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profile_private": {
                  Row: {
                    "birthdate": string,"created_at": string,"email_notifications": boolean,"id": string,"lat": number | null,"lng": number | null,"stripe_customer_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "birthdate": string,"created_at"?: string,"email_notifications"?: boolean,"id": string,"lat"?: number | null,"lng"?: number | null,"stripe_customer_id"?: string | null
                  }
                  Update: {
                    "birthdate"?: string,"created_at"?: string,"email_notifications"?: boolean,"id"?: string,"lat"?: number | null,"lng"?: number | null,"stripe_customer_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_private_id_fkey"
      columns: ["id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "account_type": Database["public"]['Enums']["account_type"],"ambitions": (string)[],"availability": Database["public"]['Enums']["availability"],"avatar_url": string | null,"bio": string,"city": string | null,"company_name": string | null,"company_website": string | null,"completed_projects_count": number,"created_at": string,"display_name": string,"experience": Database["public"]['Enums']["experience_level"],"id": string,"interests": (string)[],"is_discoverable": boolean,"is_suspended": boolean,"is_verified_organizer": boolean,"onboarded": boolean,"plan": Database["public"]['Enums']["plan_tier"],"platform_role": Database["public"]['Enums']["platform_role"],"portfolio_url": string | null,"show_joined_projects": boolean,"skills": (string)[],"updated_at": string,"username": string,"visibility": Database["public"]['Enums']["profile_visibility"]
                  }
                  ComputedFields: never
                  Insert: {
                    "account_type"?: Database["public"]['Enums']["account_type"],"ambitions"?: (string)[],"availability"?: Database["public"]['Enums']["availability"],"avatar_url"?: string | null,"bio"?: string,"city"?: string | null,"company_name"?: string | null,"company_website"?: string | null,"completed_projects_count"?: number,"created_at"?: string,"display_name": string,"experience"?: Database["public"]['Enums']["experience_level"],"id": string,"interests"?: (string)[],"is_discoverable"?: boolean,"is_suspended"?: boolean,"is_verified_organizer"?: boolean,"onboarded"?: boolean,"plan"?: Database["public"]['Enums']["plan_tier"],"platform_role"?: Database["public"]['Enums']["platform_role"],"portfolio_url"?: string | null,"show_joined_projects"?: boolean,"skills"?: (string)[],"updated_at"?: string,"username": string,"visibility"?: Database["public"]['Enums']["profile_visibility"]
                  }
                  Update: {
                    "account_type"?: Database["public"]['Enums']["account_type"],"ambitions"?: (string)[],"availability"?: Database["public"]['Enums']["availability"],"avatar_url"?: string | null,"bio"?: string,"city"?: string | null,"company_name"?: string | null,"company_website"?: string | null,"completed_projects_count"?: number,"created_at"?: string,"display_name"?: string,"experience"?: Database["public"]['Enums']["experience_level"],"id"?: string,"interests"?: (string)[],"is_discoverable"?: boolean,"is_suspended"?: boolean,"is_verified_organizer"?: boolean,"onboarded"?: boolean,"plan"?: Database["public"]['Enums']["plan_tier"],"platform_role"?: Database["public"]['Enums']["platform_role"],"portfolio_url"?: string | null,"show_joined_projects"?: boolean,"skills"?: (string)[],"updated_at"?: string,"username"?: string,"visibility"?: Database["public"]['Enums']["profile_visibility"]
                  }
                  Relationships: [
                    
                  ]
                },"project_documents": {
                  Row: {
                    "created_at": string,"id": string,"mime_type": string | null,"name": string,"project_id": string,"size_bytes": number,"storage_path": string,"uploaded_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"mime_type"?: string | null,"name": string,"project_id": string,"size_bytes": number,"storage_path": string,"uploaded_by": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"mime_type"?: string | null,"name"?: string,"project_id"?: string,"size_bytes"?: number,"storage_path"?: string,"uploaded_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_documents_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_documents_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"project_engagements": {
                  Row: {
                    "created_at": string,"kind": Database["public"]['Enums']["engagement_kind"],"project_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"kind": Database["public"]['Enums']["engagement_kind"],"project_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"kind"?: Database["public"]['Enums']["engagement_kind"],"project_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_engagements_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_engagements_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"project_members": {
                  Row: {
                    "joined_at": string,"project_id": string,"responsibility": string | null,"role": Database["public"]['Enums']["member_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "joined_at"?: string,"project_id": string,"responsibility"?: string | null,"role"?: Database["public"]['Enums']["member_role"],"user_id": string
                  }
                  Update: {
                    "joined_at"?: string,"project_id"?: string,"responsibility"?: string | null,"role"?: Database["public"]['Enums']["member_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_members_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"project_updates": {
                  Row: {
                    "author_id": string,"body": string,"created_at": string,"id": string,"project_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body": string,"created_at"?: string,"id"?: string,"project_id": string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: string,"id"?: string,"project_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_updates_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_updates_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"projects": {
                  Row: {
                    "budget_estimate_cents": number | null,"category": Database["public"]['Enums']["project_category"],"city": string | null,"cover_url": string | null,"created_at": string,"description": string,"goal": string | null,"id": string,"interest_count": number,"interest_goal": number | null,"is_demo": boolean,"is_remote": boolean,"lat": number | null,"lng": number | null,"member_count": number,"milestones_done": number,"milestones_total": number,"moderation": Database["public"]['Enums']["moderation_state"],"owner_id": string,"participant_count": number,"resources_needed": (string)[],"search": unknown,"skills_needed": (string)[],"sponsor_id": string | null,"status": Database["public"]['Enums']["project_status"],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "budget_estimate_cents"?: number | null,"category": Database["public"]['Enums']["project_category"],"city"?: string | null,"cover_url"?: string | null,"created_at"?: string,"description": string,"goal"?: string | null,"id"?: string,"interest_count"?: number,"interest_goal"?: number | null,"is_demo"?: boolean,"is_remote"?: boolean,"lat"?: number | null,"lng"?: number | null,"member_count"?: number,"milestones_done"?: number,"milestones_total"?: number,"moderation"?: Database["public"]['Enums']["moderation_state"],"owner_id": string,"participant_count"?: number,"resources_needed"?: (string)[],"search"?: never,"skills_needed"?: (string)[],"sponsor_id"?: string | null,"status"?: Database["public"]['Enums']["project_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "budget_estimate_cents"?: number | null,"category"?: Database["public"]['Enums']["project_category"],"city"?: string | null,"cover_url"?: string | null,"created_at"?: string,"description"?: string,"goal"?: string | null,"id"?: string,"interest_count"?: number,"interest_goal"?: number | null,"is_demo"?: boolean,"is_remote"?: boolean,"lat"?: number | null,"lng"?: number | null,"member_count"?: number,"milestones_done"?: number,"milestones_total"?: number,"moderation"?: Database["public"]['Enums']["moderation_state"],"owner_id"?: string,"participant_count"?: number,"resources_needed"?: (string)[],"search"?: never,"skills_needed"?: (string)[],"sponsor_id"?: string | null,"status"?: Database["public"]['Enums']["project_status"],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "projects_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "projects_sponsor_id_fkey"
      columns: ["sponsor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"rate_limit_hits": {
                  Row: {
                    "hit_at": string,"key": string
                  }
                  ComputedFields: never
                  Insert: {
                    "hit_at"?: string,"key": string
                  }
                  Update: {
                    "hit_at"?: string,"key"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reports": {
                  Row: {
                    "created_at": string,"details": string | null,"id": string,"reason": string,"reporter_id": string,"resolution_note": string | null,"resolved_at": string | null,"resolved_by": string | null,"status": Database["public"]['Enums']["report_status"],"target_id": string,"target_type": Database["public"]['Enums']["report_target"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"details"?: string | null,"id"?: string,"reason": string,"reporter_id": string,"resolution_note"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: Database["public"]['Enums']["report_status"],"target_id": string,"target_type": Database["public"]['Enums']["report_target"]
                  }
                  Update: {
                    "created_at"?: string,"details"?: string | null,"id"?: string,"reason"?: string,"reporter_id"?: string,"resolution_note"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: Database["public"]['Enums']["report_status"],"target_id"?: string,"target_type"?: Database["public"]['Enums']["report_target"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"stripe_events": {
                  Row: {
                    "id": string,"processed_at": string,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id": string,"processed_at"?: string,"type": string
                  }
                  Update: {
                    "id"?: string,"processed_at"?: string,"type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"subscriptions": {
                  Row: {
                    "current_period_end": string | null,"plan": Database["public"]['Enums']["plan_tier"],"status": string,"stripe_subscription_id": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "current_period_end"?: string | null,"plan": Database["public"]['Enums']["plan_tier"],"status": string,"stripe_subscription_id"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "current_period_end"?: string | null,"plan"?: Database["public"]['Enums']["plan_tier"],"status"?: string,"stripe_subscription_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "assignee_id": string | null,"created_at": string,"created_by": string,"description": string | null,"due_date": string | null,"id": string,"milestone_id": string | null,"project_id": string,"status": Database["public"]['Enums']["task_status"],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assignee_id"?: string | null,"created_at"?: string,"created_by": string,"description"?: string | null,"due_date"?: string | null,"id"?: string,"milestone_id"?: string | null,"project_id": string,"status"?: Database["public"]['Enums']["task_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "assignee_id"?: string | null,"created_at"?: string,"created_by"?: string,"description"?: string | null,"due_date"?: string | null,"id"?: string,"milestone_id"?: string | null,"project_id"?: string,"status"?: Database["public"]['Enums']["task_status"],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_assignee_id_fkey"
      columns: ["assignee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_milestone_id_fkey"
      columns: ["milestone_id"]
isOneToOne: false
      referencedRelation: "milestones"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "actor_name":
{ Args: { "p"?: string }; Returns: string
                           },
"admin_stats":
{ Args: Record<PropertyKey, never>; Returns: {
              "metric": string,"value": number
            }[]
                           },
"admin_update_user":
{ Args: { "p_account_type"?: Database["public"]['Enums']["account_type"],"p_plan"?: Database["public"]['Enums']["plan_tier"],"p_role"?: Database["public"]['Enums']["platform_role"],"p_suspended"?: boolean,"p_user": string,"p_verified_organizer"?: boolean }; Returns: undefined
                           },
"ai_quota":
{ Args: { "p_user"?: string }; Returns: {
              "monthly_credits": number,"plan": Database["public"]['Enums']["plan_tier"],"remaining": number,"used": number
            }[]
                           },
"are_contacts":
{ Args: { "a": string,"b": string }; Returns: boolean
                           },
"become_business":
{ Args: { "p_company": string,"p_website"?: string }; Returns: undefined
                           },
"can_view_project":
{ Args: { "p": string }; Returns: boolean
                           },
"check_rate_limit":
{ Args: { "p_key": string,"p_max": number,"p_window_seconds": number }; Returns: boolean
                           },
"clean_tags":
{ Args: { "max_items"?: number,"tags": (string)[] }; Returns: (string)[]
                           },
"community_demand_stats":
{ Args: Record<PropertyKey, never>; Returns: {
              "count": number,"dimension": string,"label": string
            }[]
                           },
"create_group_conversation":
{ Args: { "p_members": (string)[],"p_title": string }; Returns: string
                           },
"decide_application":
{ Args: { "p_accept": boolean,"p_application": string,"p_responsibility"?: string }; Returns: Database["public"]['Enums']["application_status"]
                           },
"get_or_create_direct_conversation":
{ Args: { "p_other": string }; Returns: string
                           },
"has_platform_role":
{ Args: { "min_role": Database["public"]['Enums']["platform_role"] }; Returns: boolean
                           },
"is_active_user":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_blocked_between":
{ Args: { "a": string,"b": string }; Returns: boolean
                           },
"is_conversation_participant":
{ Args: { "c": string,"u"?: string }; Returns: boolean
                           },
"is_project_manager":
{ Args: { "p": string,"u"?: string }; Returns: boolean
                           },
"is_project_member":
{ Args: { "p": string,"u"?: string }; Returns: boolean
                           },
"log_admin":
{ Args: { "p_action": string,"p_details"?: Json,"p_id": string,"p_type": string }; Returns: undefined
                           },
"mark_conversation_read":
{ Args: { "p_conversation": string }; Returns: undefined
                           },
"matching_candidates":
{ Args: { "p_limit"?: number,"p_project": string }; Returns: {
              "ambitions": (string)[],"availability": Database["public"]['Enums']["availability"],"avatar_url": string,"bio": string,"city": string,"completed_projects_count": number,"display_name": string,"distance_km": number,"experience": Database["public"]['Enums']["experience_level"],"has_applied": boolean,"id": string,"interests": (string)[],"is_interested": boolean,"skills": (string)[],"username": string
            }[]
                           },
"moderate_content":
{ Args: { "p_hide": boolean,"p_id": string,"p_type": Database["public"]['Enums']["report_target"] }; Returns: undefined
                           },
"notify":
{ Args: { "p_actor"?: string,"p_body": string,"p_link": string,"p_title": string,"p_type": string,"p_user": string }; Returns: undefined
                           },
"project_role":
{ Args: { "p": string,"u"?: string }; Returns: Database["public"]['Enums']["member_role"]
                           },
"projects_near_me":
{ Args: { "p_limit"?: number,"p_radius_km"?: number }; Returns: {
              "distance_km": number,"project_id": string
            }[]
                           },
"recount_milestones":
{ Args: { "p": string }; Returns: undefined
                           },
"resolve_report":
{ Args: { "p_note"?: string,"p_report": string,"p_status": Database["public"]['Enums']["report_status"] }; Returns: undefined
                           },
"respond_contact_request":
{ Args: { "p_accept": boolean,"p_request": string }; Returns: string
                           },
"respond_proposal":
{ Args: { "p_accept": boolean,"p_proposal": string }; Returns: undefined
                           },
"search_projects":
{ Args: { "p_category"?: Database["public"]['Enums']["project_category"],"p_limit"?: number,"p_query": string }; Returns: {
              "budget_estimate_cents": number | null,
"category": Database["public"]['Enums']["project_category"],
"city": string | null,
"cover_url": string | null,
"created_at": string,
"description": string,
"goal": string | null,
"id": string,
"interest_count": number,
"interest_goal": number | null,
"is_demo": boolean,
"is_remote": boolean,
"lat": number | null,
"lng": number | null,
"member_count": number,
"milestones_done": number,
"milestones_total": number,
"moderation": Database["public"]['Enums']["moderation_state"],
"owner_id": string,
"participant_count": number,
"resources_needed": (string)[],
"search": unknown,
"skills_needed": (string)[],
"sponsor_id": string | null,
"status": Database["public"]['Enums']["project_status"],
"title": string,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "projects"
        isOneToOne: false
        isSetofReturn: true
      } },
"set_milestone_done":
{ Args: { "p_done": boolean,"p_milestone": string }; Returns: undefined
                           },
"tags_to_text":
{ Args: { "tags": (string)[] }; Returns: string
                           },
"try_uuid":
{ Args: { "t": string }; Returns: string
                           },
"withdraw_application":
{ Args: { "p_application": string }; Returns: undefined
                           }
          }
          Enums: {
            "account_type": "personal"|"business","application_status": "pending"|"accepted"|"rejected"|"withdrawn","availability": "unavailable"|"few_hours"|"part_time"|"full_time","contact_status": "pending"|"accepted"|"declined","conversation_kind": "direct"|"group"|"project","engagement_kind": "interested"|"participating","event_stage": "proposed"|"preparing"|"confirmed"|"cancelled","experience_level": "beginner"|"intermediate"|"experienced"|"expert","member_role": "owner"|"admin"|"member","moderation_state": "visible"|"hidden","opportunity_kind": "mission"|"collaboration"|"call"|"partnership"|"service","plan_tier": "free"|"plus"|"business","platform_role": "user"|"moderator"|"admin"|"superadmin","profile_visibility": "public"|"members","project_category": "business"|"event"|"people"|"creation"|"opportunity","project_status": "idea"|"recruiting"|"preparing"|"in_progress"|"completed"|"cancelled","proposal_status": "pending"|"accepted"|"declined","report_status": "open"|"reviewing"|"resolved"|"dismissed","report_target": "project"|"comment"|"message"|"profile"|"opportunity","task_status": "todo"|"doing"|"done"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "account_type": ["personal", "business"],"application_status": ["pending", "accepted", "rejected", "withdrawn"],"availability": ["unavailable", "few_hours", "part_time", "full_time"],"contact_status": ["pending", "accepted", "declined"],"conversation_kind": ["direct", "group", "project"],"engagement_kind": ["interested", "participating"],"event_stage": ["proposed", "preparing", "confirmed", "cancelled"],"experience_level": ["beginner", "intermediate", "experienced", "expert"],"member_role": ["owner", "admin", "member"],"moderation_state": ["visible", "hidden"],"opportunity_kind": ["mission", "collaboration", "call", "partnership", "service"],"plan_tier": ["free", "plus", "business"],"platform_role": ["user", "moderator", "admin", "superadmin"],"profile_visibility": ["public", "members"],"project_category": ["business", "event", "people", "creation", "opportunity"],"project_status": ["idea", "recruiting", "preparing", "in_progress", "completed", "cancelled"],"proposal_status": ["pending", "accepted", "declined"],"report_status": ["open", "reviewing", "resolved", "dismissed"],"report_target": ["project", "comment", "message", "profile", "opportunity"],"task_status": ["todo", "doing", "done"]
          }
        }
} as const
