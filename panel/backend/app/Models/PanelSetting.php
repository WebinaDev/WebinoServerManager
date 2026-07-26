<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PanelSetting extends Model
{
    public $incrementing = false;

    protected $primaryKey = 'key';

    protected $keyType = 'string';

    protected $fillable = [
        'key',
        'value',
        'value_encrypted',
    ];

    public static function getValue(string $key, ?string $default = null): ?string
    {
        $row = static::query()->find($key);

        return $row?->value ?? $default;
    }

    public static function getEncrypted(string $key): ?string
    {
        $row = static::query()->find($key);
        if ($row === null || $row->value_encrypted === null) {
            return null;
        }

        try {
            return decrypt($row->value_encrypted);
        } catch (\Throwable) {
            return null;
        }
    }

    public static function setValue(string $key, ?string $value): void
    {
        static::query()->updateOrCreate(['key' => $key], ['value' => $value]);
    }

    public static function setEncrypted(string $key, ?string $value): void
    {
        static::query()->updateOrCreate(
            ['key' => $key],
            ['value_encrypted' => $value !== null && $value !== '' ? encrypt($value) : null],
        );
    }
}
