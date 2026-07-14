import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:onesign_console/core/config/app_env.dart';
import 'package:onesign_console/core/supabase/supabase_bootstrap.dart';

class AppApiClient {
  Future<String> _accessToken() async {
    final session = supabase.auth.currentSession;
    if (session == null) throw StateError('Not signed in');
    return session.accessToken;
  }

  Future<Map<String, dynamic>> signInWithGoogleIdToken(String idToken) async {
    final response = await http.post(
      Uri.parse('${AppEnv.appUrl}/api/auth/mobile-google'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'idToken': idToken}),
    );
    final body = _decode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(body['error']?.toString() ?? 'Google sign-in failed');
    }
    return body;
  }

  Future<void> uploadMedia({
    required File file,
    required String ownerId,
    required String workspaceId,
  }) async {
    final token = await _accessToken();
    final uri = Uri.parse('${AppEnv.appUrl}/api/media/upload');
    final req = http.MultipartRequest('POST', uri)
      ..headers['Authorization'] = 'Bearer $token'
      ..fields['ownerId'] = ownerId
      ..fields['workspaceId'] = workspaceId
      ..files.add(await http.MultipartFile.fromPath('file', file.path));

    final streamed = await req.send();
    final responseBody = await streamed.stream.bytesToString();
    if (streamed.statusCode < 200 || streamed.statusCode >= 300) {
      final decoded = _decode(responseBody);
      throw Exception(
        decoded['error']?.toString() ??
            'Upload failed (${streamed.statusCode})',
      );
    }
  }

  Future<void> createWebsiteUrl({
    required String ownerId,
    required String workspaceId,
    required String name,
    required String url,
  }) async {
    final token = await _accessToken();
    final response = await http.post(
      Uri.parse('${AppEnv.appUrl}/api/websites/create'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'ownerId': ownerId,
        'workspaceId': workspaceId,
        'name': name,
        'sourceType': 'url',
        'url': url,
      }),
    );
    final body = _decode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(body['error']?.toString() ?? 'Create website failed');
    }
  }

  Future<void> inviteAccountUser({
    required String email,
    String? firstName,
    String? lastName,
    required List<Map<String, dynamic>> roles,
  }) async {
    final token = await _accessToken();
    final response = await http.post(
      Uri.parse('${AppEnv.appUrl}/api/account/invite-user'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'email': email,
        if (firstName != null) 'firstName': firstName,
        if (lastName != null) 'lastName': lastName,
        'roles': roles,
      }),
    );
    final body = _decode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(body['error']?.toString() ?? 'Invite failed');
    }
  }

  Future<void> resendInvite({required String email, String? displayName}) async {
    final token = await _accessToken();
    final response = await http.post(
      Uri.parse('${AppEnv.appUrl}/api/account/resend-invite'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'email': email,
        if (displayName != null) 'displayName': displayName,
      }),
    );
    final body = _decode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(body['error']?.toString() ?? 'Resend failed');
    }
  }

  Map<String, dynamic> _decode(String raw) {
    if (raw.isEmpty) return {};
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) return decoded;
      if (decoded is Map) return Map<String, dynamic>.from(decoded);
      return {'error': raw};
    } catch (_) {
      return {'error': raw};
    }
  }
}
