export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      collection_items: {
        Row: { collection_id: string; id: string; move_id: string; position: number }
        Insert: { collection_id: string; id?: string; move_id: string; position: number }
        Update: { collection_id?: string; id?: string; move_id?: string; position?: number }
        Relationships: []
      }
      collections: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          owner_id: string
          share_slug: string | null
          sort_order: number | null
          visibility: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          owner_id: string
          share_slug?: string | null
          sort_order?: number | null
          visibility?: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          share_slug?: string | null
          sort_order?: number | null
          visibility?: string
        }
        Relationships: []
      }
      combo_items: {
        Row: { combo_id: string; id: string; move_id: string; position: number }
        Insert: { combo_id: string; id?: string; move_id: string; position: number }
        Update: { combo_id?: string; id?: string; move_id?: string; position?: number }
        Relationships: []
      }
      lessons: {
        Row: {
          id: string
          owner_id: string
          title: string
          school: string | null
          course: string | null
          lesson_number: number | null
          position: number | null
          video_id: string | null
          notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          owner_id: string
          title: string
          school?: string | null
          course?: string | null
          lesson_number?: number | null
          position?: number | null
          video_id?: string | null
          notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          owner_id?: string
          title?: string
          school?: string | null
          course?: string | null
          lesson_number?: number | null
          position?: number | null
          video_id?: string | null
          notes?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      move_user_data: {
        Row: {
          favorite: boolean | null
          learned: boolean | null
          learned_at: string | null
          move_id: string
          next_up: boolean | null
          notes: string | null
          party: boolean | null
          practicing: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          favorite?: boolean | null
          learned?: boolean | null
          learned_at?: string | null
          move_id: string
          next_up?: boolean | null
          notes?: string | null
          party?: boolean | null
          practicing?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          favorite?: boolean | null
          learned?: boolean | null
          learned_at?: string | null
          move_id?: string
          next_up?: boolean | null
          notes?: string | null
          party?: boolean | null
          practicing?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      moves: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          is_official: boolean | null
          kind: string
          legacy_id: string | null
          level: number | null
          media_url: string | null
          name: string
          owner_id: string | null
          source_links: Json | null
          style: string
          tags: string[] | null
          thumb_url: string | null
          updated_at: string | null
          video_id: string | null
          visibility: string
          youtube_id: string | null
          clip_start: number | null
          clip_end: number | null
          lesson_id: string | null
          variation_of: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_official?: boolean | null
          kind?: string
          legacy_id?: string | null
          level?: number | null
          media_url?: string | null
          name: string
          owner_id?: string | null
          source_links?: Json | null
          style?: string
          tags?: string[] | null
          thumb_url?: string | null
          updated_at?: string | null
          video_id?: string | null
          visibility?: string
          youtube_id?: string | null
          clip_start?: number | null
          clip_end?: number | null
          lesson_id?: string | null
          variation_of?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_official?: boolean | null
          kind?: string
          legacy_id?: string | null
          level?: number | null
          media_url?: string | null
          name?: string
          owner_id?: string | null
          source_links?: Json | null
          style?: string
          tags?: string[] | null
          thumb_url?: string | null
          updated_at?: string | null
          video_id?: string | null
          visibility?: string
          youtube_id?: string | null
          clip_start?: number | null
          clip_end?: number | null
          lesson_id?: string | null
          variation_of?: string | null
        }
        Relationships: []
      }
      move_media: {
        Row: {
          id: string
          move_id: string
          label: string | null
          youtube_id: string | null
          media_url: string | null
          thumb_url: string | null
          clip_start: number | null
          clip_end: number | null
          source_url: string | null
          position: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          move_id: string
          label?: string | null
          youtube_id?: string | null
          media_url?: string | null
          thumb_url?: string | null
          clip_start?: number | null
          clip_end?: number | null
          source_url?: string | null
          position?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          move_id?: string
          label?: string | null
          youtube_id?: string | null
          media_url?: string | null
          thumb_url?: string | null
          clip_start?: number | null
          clip_end?: number | null
          source_url?: string | null
          position?: number | null
          created_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          username?: string | null
        }
        Relationships: []
      }
      videos: {
        Row: {
          created_at: string | null
          duration_s: number | null
          id: string
          owner_id: string
          size_bytes: number | null
          storage_path: string
          thumb_path: string | null
          title: string | null
          visibility: string
        }
        Insert: {
          created_at?: string | null
          duration_s?: number | null
          id?: string
          owner_id: string
          size_bytes?: number | null
          storage_path: string
          thumb_path?: string | null
          title?: string | null
          visibility?: string
        }
        Update: {
          created_at?: string | null
          duration_s?: number | null
          id?: string
          owner_id?: string
          size_bytes?: number | null
          storage_path?: string
          thumb_path?: string | null
          title?: string | null
          visibility?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

/* ---- App-level convenience types ---- */
export type Move = Database['public']['Tables']['moves']['Row']
export type MoveInsert = Database['public']['Tables']['moves']['Insert']
export type MoveUserData = Database['public']['Tables']['move_user_data']['Row']
export type Collection = Database['public']['Tables']['collections']['Row']
export type CollectionItem = Database['public']['Tables']['collection_items']['Row']
export type ComboItem = Database['public']['Tables']['combo_items']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type VideoRow = Database['public']['Tables']['videos']['Row']
export type Lesson = Database['public']['Tables']['lessons']['Row']
export type LessonInsert = Database['public']['Tables']['lessons']['Insert']
export type MoveMedia = Database['public']['Tables']['move_media']['Row']
export type MoveMediaInsert = Database['public']['Tables']['move_media']['Insert']

/** A unified, playable media descriptor (from a move's primary fields or a move_media row). */
export type MediaSource = {
  id: string
  label: string | null
  youtube_id: string | null
  media_url: string | null
  thumb_url: string | null
  clip_start: number | null
  clip_end: number | null
  source_url?: string | null
}

export type SourceLink = { label: string; url: string }
export type Visibility = 'private' | 'unlisted' | 'public'
export type StatusFlag = 'learned' | 'practicing' | 'favorite' | 'party' | 'next_up'
