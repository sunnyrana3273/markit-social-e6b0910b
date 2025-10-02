export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      activity_feed: {
        Row: {
          action_type: string
          actor_id: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action_type: string
          actor_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action_type?: string
          actor_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      ai_threads: {
        Row: {
          answer: string | null
          board_id: string | null
          created_at: string | null
          created_by: string | null
          element_id: string | null
          id: string
          image_data: string | null
          model_used: string | null
          question: string
          tokens_input: number | null
          tokens_output: number | null
        }
        Insert: {
          answer?: string | null
          board_id?: string | null
          created_at?: string | null
          created_by?: string | null
          element_id?: string | null
          id?: string
          image_data?: string | null
          model_used?: string | null
          question: string
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Update: {
          answer?: string | null
          board_id?: string | null
          created_at?: string | null
          created_by?: string | null
          element_id?: string | null
          id?: string
          image_data?: string | null
          model_used?: string | null
          question?: string
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_threads_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      boards: {
        Row: {
          created_at: string | null
          document_id: string | null
          id: string
          scene_data: Json | null
          scene_version: number | null
          session_id: string | null
          storage_path: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          document_id?: string | null
          id?: string
          scene_data?: Json | null
          scene_version?: number | null
          session_id?: string | null
          storage_path?: string | null
          title?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          document_id?: string | null
          id?: string
          scene_data?: Json | null
          scene_version?: number | null
          session_id?: string | null
          storage_path?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "boards_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "study_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          created_at: string
          id: string
          is_user: boolean
          message_type: string | null
          metadata: Json | null
          quote: string | null
          session_id: string
          text: string
          thread_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_user?: boolean
          message_type?: string | null
          metadata?: Json | null
          quote?: string | null
          session_id: string
          text: string
          thread_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_user?: boolean
          message_type?: string | null
          metadata?: Json | null
          quote?: string | null
          session_id?: string
          text?: string
          thread_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      community_discussions: {
        Row: {
          community_id: string
          content: string
          created_at: string | null
          id: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          community_id: string
          content: string
          created_at?: string | null
          id?: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          community_id?: string
          content?: string
          created_at?: string | null
          id?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_discussions_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "course_communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_memberships: {
        Row: {
          community_id: string
          id: string
          joined_at: string | null
          user_id: string
        }
        Insert: {
          community_id: string
          id?: string
          joined_at?: string | null
          user_id: string
        }
        Update: {
          community_id?: string
          id?: string
          joined_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_memberships_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "course_communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_presence: {
        Row: {
          community_id: string
          last_seen: string | null
          user_id: string
        }
        Insert: {
          community_id: string
          last_seen?: string | null
          user_id: string
        }
        Update: {
          community_id?: string
          last_seen?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_presence_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "course_communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_resources: {
        Row: {
          community_id: string
          created_at: string | null
          description: string | null
          id: string
          resource_type: string | null
          resource_url: string | null
          title: string
          user_id: string
        }
        Insert: {
          community_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          resource_type?: string | null
          resource_url?: string | null
          title: string
          user_id: string
        }
        Update: {
          community_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          resource_type?: string | null
          resource_url?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_resources_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "course_communities"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_metrics: {
        Row: {
          assistant_messages: number | null
          average_response_time_ms: number | null
          created_at: string
          id: string
          most_used_modes: Json | null
          session_id: string
          thread_id: string | null
          total_messages: number | null
          total_tokens_used: number | null
          updated_at: string
          user_messages: number | null
        }
        Insert: {
          assistant_messages?: number | null
          average_response_time_ms?: number | null
          created_at?: string
          id?: string
          most_used_modes?: Json | null
          session_id: string
          thread_id?: string | null
          total_messages?: number | null
          total_tokens_used?: number | null
          updated_at?: string
          user_messages?: number | null
        }
        Update: {
          assistant_messages?: number | null
          average_response_time_ms?: number | null
          created_at?: string
          id?: string
          most_used_modes?: Json | null
          session_id?: string
          thread_id?: string | null
          total_messages?: number | null
          total_tokens_used?: number | null
          updated_at?: string
          user_messages?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_metrics_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "persistent_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_metrics_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      course_communities: {
        Row: {
          course_category: string
          course_name: string
          created_at: string | null
          description: string | null
          id: string
        }
        Insert: {
          course_category: string
          course_name: string
          created_at?: string | null
          description?: string | null
          id?: string
        }
        Update: {
          course_category?: string
          course_name?: string
          created_at?: string | null
          description?: string | null
          id?: string
        }
        Relationships: []
      }
      daily_metrics: {
        Row: {
          ai_questions_asked: number | null
          date: string
          minutes_studied: number | null
          problems_completed: number | null
          sessions_joined: number | null
          streak_day: number | null
          user_id: string
        }
        Insert: {
          ai_questions_asked?: number | null
          date: string
          minutes_studied?: number | null
          problems_completed?: number | null
          sessions_joined?: number | null
          streak_day?: number | null
          user_id: string
        }
        Update: {
          ai_questions_asked?: number | null
          date?: string
          minutes_studied?: number | null
          problems_completed?: number | null
          sessions_joined?: number | null
          streak_day?: number | null
          user_id?: string
        }
        Relationships: []
      }
      friends: {
        Row: {
          created_at: string | null
          friend_id: string
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          friend_id: string
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          friend_id?: string
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      highlights: {
        Row: {
          clerk_user_id: string
          color: string
          created_at: string
          file_id: string
          id: string
          page_number: number
          selection_bounds: Json
          selection_text: string
          updated_at: string
        }
        Insert: {
          clerk_user_id: string
          color?: string
          created_at?: string
          file_id: string
          id?: string
          page_number: number
          selection_bounds: Json
          selection_text: string
          updated_at?: string
        }
        Update: {
          clerk_user_id?: string
          color?: string
          created_at?: string
          file_id?: string
          id?: string
          page_number?: number
          selection_bounds?: Json
          selection_text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "highlights_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "uploaded_files"
            referencedColumns: ["id"]
          },
        ]
      }
      message_thread_members: {
        Row: {
          created_at: string
          id: string
          message_id: string
          thread_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          thread_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_thread_members_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "conversation_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_thread_members_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "session_chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_thread_members_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      message_threads: {
        Row: {
          created_at: string
          id: string
          session_id: string
          thread_description: string | null
          thread_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          session_id: string
          thread_description?: string | null
          thread_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          session_id?: string
          thread_description?: string | null
          thread_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_threads_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "persistent_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      pdf_chunks: {
        Row: {
          content: string
          created_at: string | null
          embedding: string | null
          id: string
          page_number: number | null
          pdf_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          page_number?: number | null
          pdf_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          page_number?: number | null
          pdf_id?: string
        }
        Relationships: []
      }
      persistent_sessions: {
        Row: {
          clerk_user_id: string
          created_at: string
          id: string
          pdf_id: string
          pdf_name: string
          pdf_url: string
          updated_at: string
        }
        Insert: {
          clerk_user_id: string
          created_at?: string
          id?: string
          pdf_id: string
          pdf_name: string
          pdf_url: string
          updated_at?: string
        }
        Update: {
          clerk_user_id?: string
          created_at?: string
          id?: string
          pdf_id?: string
          pdf_name?: string
          pdf_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          first_name: string | null
          id: string
          image_url: string | null
          last_name: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          email: string
          first_name?: string | null
          id?: string
          image_url?: string | null
          last_name?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          image_url?: string | null
          last_name?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      questions: {
        Row: {
          created_at: string
          id: string
          nh: number
          nw: number
          nx: number
          ny: number
          page: number
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nh: number
          nw: number
          nx: number
          ny: number
          page: number
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nh?: number
          nw?: number
          nx?: number
          ny?: number
          page?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_chat_messages: {
        Row: {
          assets: Json | null
          created_at: string
          id: string
          is_user: boolean
          message_metadata: Json | null
          message_type: string | null
          parent_message_id: string | null
          quote: string | null
          session_id: string
          text: string
          tutoring_data: Json | null
          updated_at: string
          whiteboard_snapshot: Json | null
        }
        Insert: {
          assets?: Json | null
          created_at?: string
          id?: string
          is_user?: boolean
          message_metadata?: Json | null
          message_type?: string | null
          parent_message_id?: string | null
          quote?: string | null
          session_id: string
          text: string
          tutoring_data?: Json | null
          updated_at?: string
          whiteboard_snapshot?: Json | null
        }
        Update: {
          assets?: Json | null
          created_at?: string
          id?: string
          is_user?: boolean
          message_metadata?: Json | null
          message_type?: string | null
          parent_message_id?: string | null
          quote?: string | null
          session_id?: string
          text?: string
          tutoring_data?: Json | null
          updated_at?: string
          whiteboard_snapshot?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "session_chat_messages_parent_message_id_fkey"
            columns: ["parent_message_id"]
            isOneToOne: false
            referencedRelation: "conversation_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_chat_messages_parent_message_id_fkey"
            columns: ["parent_message_id"]
            isOneToOne: false
            referencedRelation: "session_chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "persistent_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_participants: {
        Row: {
          is_moderator: boolean | null
          joined_at: string | null
          session_id: string
          user_id: string
        }
        Insert: {
          is_moderator?: boolean | null
          joined_at?: string | null
          session_id: string
          user_id: string
        }
        Update: {
          is_moderator?: boolean | null
          joined_at?: string | null
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "study_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_questions: {
        Row: {
          created_at: string
          id: string
          image_data: string | null
          nh: number
          nw: number
          nx: number
          ny: number
          page: number
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_data?: string | null
          nh: number
          nw: number
          nx: number
          ny: number
          page: number
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_data?: string | null
          nh?: number
          nw?: number
          nx?: number
          ny?: number
          page?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_questions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "persistent_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_whiteboards: {
        Row: {
          created_at: string
          id: string
          nh: number
          nw: number
          nx: number
          ny: number
          page: number
          scene_data: Json
          session_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nh: number
          nw: number
          nx: number
          ny: number
          page: number
          scene_data?: Json
          session_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nh?: number
          nw?: number
          nx?: number
          ny?: number
          page?: number
          scene_data?: Json
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_whiteboards_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "persistent_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          clerk_user_id: string
          created_at: string
          id: string
          pdf_id: string | null
          pdf_url: string
        }
        Insert: {
          clerk_user_id: string
          created_at?: string
          id?: string
          pdf_id?: string | null
          pdf_url: string
        }
        Update: {
          clerk_user_id?: string
          created_at?: string
          id?: string
          pdf_id?: string | null
          pdf_url?: string
        }
        Relationships: []
      }
      study_sessions: {
        Row: {
          ap_course: string | null
          created_at: string | null
          description: string | null
          host_id: string | null
          id: string
          is_public: boolean | null
          max_participants: number | null
          title: string
          updated_at: string | null
          voice_room_url: string | null
        }
        Insert: {
          ap_course?: string | null
          created_at?: string | null
          description?: string | null
          host_id?: string | null
          id?: string
          is_public?: boolean | null
          max_participants?: number | null
          title: string
          updated_at?: string | null
          voice_room_url?: string | null
        }
        Update: {
          ap_course?: string | null
          created_at?: string | null
          description?: string | null
          host_id?: string | null
          id?: string
          is_public?: boolean | null
          max_participants?: number | null
          title?: string
          updated_at?: string | null
          voice_room_url?: string | null
        }
        Relationships: []
      }
      tutoring_threads: {
        Row: {
          created_at: string
          id: string
          session_id: string
          thread_description: string | null
          thread_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          session_id: string
          thread_description?: string | null
          thread_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          session_id?: string
          thread_description?: string | null
          thread_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutoring_threads_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      uploaded_files: {
        Row: {
          clerk_user_id: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          mode: string
          updated_at: string
        }
        Insert: {
          clerk_user_id: string
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          mode: string
          updated_at?: string
        }
        Update: {
          clerk_user_id?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          mode?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_quotas: {
        Row: {
          ai_queries_limit: number | null
          ai_queries_used: number | null
          created_at: string | null
          plan_type: string | null
          reset_date: string | null
          storage_limit: number | null
          storage_used: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_queries_limit?: number | null
          ai_queries_used?: number | null
          created_at?: string | null
          plan_type?: string | null
          reset_date?: string | null
          storage_limit?: number | null
          storage_used?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_queries_limit?: number | null
          ai_queries_used?: number | null
          created_at?: string | null
          plan_type?: string | null
          reset_date?: string | null
          storage_limit?: number | null
          storage_used?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_stats: {
        Row: {
          created_at: string
          current_streak: number
          favorite_community_id: string | null
          last_study_date: string | null
          lifetime_minutes_studied: number
          lifetime_questions_answered: number
          longest_streak: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          favorite_community_id?: string | null
          last_study_date?: string | null
          lifetime_minutes_studied?: number
          lifetime_questions_answered?: number
          longest_streak?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          favorite_community_id?: string | null
          last_study_date?: string | null
          lifetime_minutes_studied?: number
          lifetime_questions_answered?: number
          longest_streak?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_stats_favorite_community_id_fkey"
            columns: ["favorite_community_id"]
            isOneToOne: false
            referencedRelation: "course_communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whiteboard_events: {
        Row: {
          delta_json: Json
          id: string
          question_id: string
          seq: number
          ts: string
        }
        Insert: {
          delta_json: Json
          id?: string
          question_id: string
          seq: number
          ts?: string
        }
        Update: {
          delta_json?: Json
          id?: string
          question_id?: string
          seq?: number
          ts?: string
        }
        Relationships: [
          {
            foreignKeyName: "whiteboard_events_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      whiteboard_state: {
        Row: {
          question_id: string
          scene_json: Json
          updated_at: string
        }
        Insert: {
          question_id: string
          scene_json: Json
          updated_at?: string
        }
        Update: {
          question_id?: string
          scene_json?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whiteboard_state_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: true
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      whiteboards: {
        Row: {
          clerk_user_id: string
          created_at: string
          id: string
          pdf_id: string
          scene: Json
          updated_at: string
        }
        Insert: {
          clerk_user_id: string
          created_at?: string
          id?: string
          pdf_id: string
          scene?: Json
          updated_at?: string
        }
        Update: {
          clerk_user_id?: string
          created_at?: string
          id?: string
          pdf_id?: string
          scene?: Json
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      conversation_view: {
        Row: {
          assets: Json | null
          clerk_user_id: string | null
          created_at: string | null
          id: string | null
          is_user: boolean | null
          message_metadata: Json | null
          message_type: string | null
          parent_message_id: string | null
          pdf_id: string | null
          pdf_name: string | null
          quote: string | null
          session_id: string | null
          text: string | null
          tutoring_data: Json | null
          updated_at: string | null
          whiteboard_snapshot: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "session_chat_messages_parent_message_id_fkey"
            columns: ["parent_message_id"]
            isOneToOne: false
            referencedRelation: "conversation_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_chat_messages_parent_message_id_fkey"
            columns: ["parent_message_id"]
            isOneToOne: false
            referencedRelation: "session_chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "persistent_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      match_chunks: {
        Args: { match_count: number; query_embedding: string }
        Returns: {
          content: string
          id: string
          page_number: number
          similarity: number
        }[]
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
