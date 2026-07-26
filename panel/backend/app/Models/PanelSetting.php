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

    public static function get(string $key, mixed $default = null): mixed
    {
        $row = static::query()->find($key);
        if ($row === null) {
            return $default;
        }
        $value = $row->value;
        if ($value === null) {
            return $default;
        }
        if ($value === '1' || $value === '0') {
            // keep string for callers that cast; also support bool-ish stored values
        }

        return $value;
    }

    public static function set(string $key, mixed $value): void
    {
        if (is_bool($value)) {
            $value = $value ? '1' : '0';
        } elseif (is_array($value) || is_object($value)) {
            $value = json_encode($value);
        } elseif ($value !== null) {
            $value = (string) $value;
        }

        static::query()->updateOrCreate(['key' => $key], ['value' => $value]);
    }

    public static function getValue(string $key, ?string $default = null): ?string
    {
        $v = static::get($key, $default);

        return $v === null ? $default : (string) $v;
    }

    public static function setValue(string $key, ?string $value): void
    {
        static::set($key, $value);
    }

    public static function getEncrypted(string $key): ?string
    {
        $row = static::query()->find($key);
        if ($row === null || $row->value_encrypted === null || $row->value_encrypted === '') {
            return null;
        }

        try {
            return decrypt($row->value_encrypted);
        } catch (\Throwable) {
            return null;
        }
    }

    public static function setEncrypted(string $key, ?string $value): void
    {
        static::query()->updateOrCreate(
            ['key' => $key],
            ['value_encrypted' => $value !== null && $value !== '' ? encrypt($value) : null],
        );
    }
}
