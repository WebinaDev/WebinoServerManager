<?php

namespace Modules\Apps\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;

class DockerRegistry extends Model
{
    protected $table = 'docker_registries';

    protected $fillable = [
        'name',
        'server',
        'username',
        'password_encrypted',
    ];

    protected $hidden = [
        'password_encrypted',
    ];

    public function setPasswordAttribute(string $plain): void
    {
        $this->attributes['password_encrypted'] = Crypt::encryptString($plain);
    }

    public function plainPassword(): string
    {
        return Crypt::decryptString($this->password_encrypted);
    }
}
