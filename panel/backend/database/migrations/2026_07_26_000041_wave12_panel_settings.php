<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('panel_settings')) {
            Schema::create('panel_settings', function (Blueprint $table) {
                $table->string('key', 64)->primary();
                $table->text('value')->nullable();
                $table->text('value_encrypted')->nullable();
                $table->timestamps();
            });

            return;
        }

        Schema::table('panel_settings', function (Blueprint $table) {
            if (! Schema::hasColumn('panel_settings', 'value_encrypted')) {
                $table->text('value_encrypted')->nullable()->after('value');
            }
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('panel_settings') && Schema::hasColumn('panel_settings', 'value_encrypted')) {
            Schema::table('panel_settings', function (Blueprint $table) {
                $table->dropColumn('value_encrypted');
            });
        }
    }
};
