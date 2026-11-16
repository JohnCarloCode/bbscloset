export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      favorite_items: {
        Row: {
          favorite_id: string;
          garment_id: string;
          id: string;
          rotation: number | null;
          scale: number | null;
          user_id: string;
          x: number | null;
          y: number | null;
          z: number | null;
        };
        Insert: {
          favorite_id: string;
          garment_id: string;
          id?: string;
          rotation?: number | null;
          scale?: number | null;
          user_id: string;
          x?: number | null;
          y?: number | null;
          z?: number | null;
        };
        Update: {
          favorite_id?: string;
          garment_id?: string;
          id?: string;
          rotation?: number | null;
          scale?: number | null;
          user_id?: string;
          x?: number | null;
          y?: number | null;
          z?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "favorite_items_favorite_id_fkey";
            columns: ["favorite_id"];
            isOneToOne: false;
            referencedRelation: "favorites";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "favorite_items_garment_id_fkey";
            columns: ["garment_id"];
            isOneToOne: false;
            referencedRelation: "garments";
            referencedColumns: ["id"];
          },
        ];
      };
      favorites: {
        Row: {
          created_at: string;
          id: string;
          name: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      garment_tags: {
        Row: {
          garment_id: string;
          tag_id: string;
          user_id: string;
        };
        Insert: {
          garment_id: string;
          tag_id: string;
          user_id: string;
        };
        Update: {
          garment_id?: string;
          tag_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "garment_tags_garment_id_fkey";
            columns: ["garment_id"];
            isOneToOne: false;
            referencedRelation: "garments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "garment_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ];
      };
      garment_types: {
        Row: {
          id: string;
          slot_id: string;
        };
        Insert: {
          id: string;
          slot_id: string;
        };
        Update: {
          id?: string;
          slot_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "garment_types_slot_id_fkey";
            columns: ["slot_id"];
            isOneToOne: false;
            referencedRelation: "slots";
            referencedColumns: ["id"];
          },
        ];
      };
      garments: {
        Row: {
          archived: boolean;
          brand: string | null;
          color_family: string | null;
          color_hex: string | null;
          created_at: string;
          id: string;
          image_path: string;
          name: string | null;
          seasons: string[];
          thumb_path: string;
          type_id: string;
          user_id: string;
        };
        Insert: {
          archived?: boolean;
          brand?: string | null;
          color_family?: string | null;
          color_hex?: string | null;
          created_at?: string;
          id?: string;
          image_path: string;
          name?: string | null;
          seasons?: string[];
          thumb_path: string;
          type_id: string;
          user_id: string;
        };
        Update: {
          archived?: boolean;
          brand?: string | null;
          color_family?: string | null;
          color_hex?: string | null;
          created_at?: string;
          id?: string;
          image_path?: string;
          name?: string | null;
          seasons?: string[];
          thumb_path?: string;
          type_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "garments_type_id_fkey";
            columns: ["type_id"];
            isOneToOne: false;
            referencedRelation: "garment_types";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          jewelry_max: number;
          language: string;
          random_slots: string[];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          jewelry_max?: number;
          language?: string;
          random_slots?: string[];
          user_id: string;
        };
        Update: {
          created_at?: string;
          jewelry_max?: number;
          language?: string;
          random_slots?: string[];
          user_id?: string;
        };
        Relationships: [];
      };
      slots: {
        Row: {
          default_z: number;
          id: string;
          multi: boolean;
          size_weight: number;
          sort_order: number;
        };
        Insert: {
          default_z: number;
          id: string;
          multi?: boolean;
          size_weight: number;
          sort_order: number;
        };
        Update: {
          default_z?: number;
          id?: string;
          multi?: boolean;
          size_weight?: number;
          sort_order?: number;
        };
        Relationships: [];
      };
      tags: {
        Row: {
          id: string;
          name: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          name: string;
          user_id: string;
        };
        Update: {
          id?: string;
          name?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      waitlist: {
        Row: {
          created_at: string;
          email: string;
          id: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
