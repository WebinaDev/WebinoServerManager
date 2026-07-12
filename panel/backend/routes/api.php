<?php

use Illuminate\Support\Facades\Route;

/*
| WebinoServer panel API — module routes are loaded from Modules/{Name}/Routes/api.php
*/

Route::get('/v1/health', fn () => response()->json(['status' => 'ok', 'service' => 'webinoserver-panel']));
