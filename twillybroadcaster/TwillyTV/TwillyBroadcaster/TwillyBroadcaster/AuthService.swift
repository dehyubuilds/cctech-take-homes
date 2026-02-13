//
//  AuthService.swift
//  TwillyBroadcaster
//
//  Authentication service using AWS Amplify Cognito
//

import Foundation
import Amplify
import AmplifyPlugins
import Combine

class AuthService: ObservableObject {
    static let shared = AuthService()
    
    @Published var isAuthenticated = false
    @Published var currentUser: AuthUser?
    @Published var userEmail: String?
    @Published var userId: String?
    @Published var username: String?
    @Published var isLoading = false
    @Published var isLoadingUsername = false
    @Published var errorMessage: String?
    
    private var cancellables = Set<AnyCancellable>()
    
    private init() {
        configureAmplify()
        checkAuthStatus()
    }
    
    private var isConfigured = false
    
    private func configureAmplify() {
        // Check if already configured
        if isConfigured {
            print("✅ [AuthService] Amplify already configured")
            return
        }
        
        do {
            // Add Cognito Auth plugin FIRST (required before configuration)
            // Wrap in do-catch to handle "plugin already added" errors gracefully
            do {
                try Amplify.add(plugin: AWSCognitoAuthPlugin())
                print("✅ [AuthService] AWSCognitoAuthPlugin added successfully")
            } catch {
                // If plugin is already added, that's okay - continue with configuration
                let errorString = error.localizedDescription.lowercased()
                if errorString.contains("already") || errorString.contains("duplicate") {
                    print("⚠️ [AuthService] AWSCognitoAuthPlugin already added (continuing...)")
                } else {
                    // Re-throw if it's a different error
                    throw error
                }
            }
            
            // Use programmatic configuration (more reliable than JSON parsing)
            // This matches the amplifyconfiguration.json structure exactly
            let authConfig = AuthCategoryConfiguration(
                plugins: [
                    "awsCognitoAuthPlugin": [
                        "UserAgent": "aws-amplify/cli",
                        "Version": "1.0",
                        "CognitoUserPool": [
                            "Default": [
                                "PoolId": "us-east-1_hbYWvnY7Q",
                                "AppClientId": "71v0e7uf8f0l0l05jcjisn1lp0",
                                "Region": "us-east-1"
                            ]
                        ],
                        "Auth": [
                            "Default": [
                                "authenticationFlowType": "USER_SRP_AUTH",
                                "usernameAttributes": ["email"]
                            ]
                        ]
                    ]
                ]
            )
            
            let amplifyConfig = AmplifyConfiguration(auth: authConfig)
            try Amplify.configure(amplifyConfig)
            isConfigured = true
            print("✅ [AuthService] Amplify configured successfully")
            
            // Verify configuration by checking if we can access Auth
            let _ = Amplify.Auth
            print("✅ [AuthService] Amplify Auth is accessible and ready")
            
        } catch {
            // CRITICAL: Don't set isConfigured = true if configuration fails
            isConfigured = false
            print("❌ [AuthService] Failed to configure Amplify: \(error.localizedDescription)")
            print("❌ [AuthService] Full error: \(error)")
            print("❌ [AuthService] Error type: \(type(of: error))")
            if let nsError = error as NSError? {
                print("❌ [AuthService] Error domain: \(nsError.domain), code: \(nsError.code)")
                print("❌ [AuthService] Error userInfo: \(nsError.userInfo)")
                if let underlyingError = nsError.userInfo[NSUnderlyingErrorKey] as? NSError {
                    print("❌ [AuthService] Underlying error: \(underlyingError.localizedDescription)")
                    print("❌ [AuthService] Underlying error domain: \(underlyingError.domain), code: \(underlyingError.code)")
                }
            }
            // Set error message so user knows what went wrong
            DispatchQueue.main.async {
                self.errorMessage = "Failed to initialize authentication. Please restart the app."
            }
        }
    }
    
    func checkAuthStatus() {
        Task {
            // Try to get the current user - returns nil if not signed in
            if let user = Amplify.Auth.getCurrentUser() {
                // User exists and is authenticated
                await MainActor.run {
                    self.currentUser = user
                    self.isAuthenticated = true
                    self.userEmail = user.username // Email is used as username
                    self.userId = user.userId
                    // CRITICAL FIX: Only load username if we don't already have one
                    // This prevents flashing the username setup screen for existing users
                    if self.username == nil {
                        // Don't set isLoadingUsername here - let loadUsername() manage its own state
                        loadUsername()
                    } else {
                        // Username already exists - don't show loading state
                        self.isLoadingUsername = false
                        print("✅ [AuthService] Username already set: \(self.username ?? "nil"), skipping load")
                    }
                }
            } else {
                // User is not signed in
                await MainActor.run {
                    self.isAuthenticated = false
                    self.currentUser = nil
                    self.userEmail = nil
                    self.userId = nil
                    self.username = nil
                    self.isLoadingUsername = false
                }
            }
        }
    }
    
    func signUp(email: String, password: String) async throws -> AuthSignUpResult {
        // Ensure Amplify is configured (same as sign in - no special checks)
        // If not configured, try to configure it
        if !isConfigured {
            print("⚠️ [AuthService] Amplify not configured, attempting configuration...")
            configureAmplify()
        }
        
        await MainActor.run {
            isLoading = true
            errorMessage = nil
        }
        
        let options = AuthSignUpOperation.Request.Options(
            userAttributes: [
                AuthUserAttribute(.email, value: email)
            ]
        )
        
        print("🔍 [AuthService] Attempting sign up for: \(email.lowercased())")
        
        // Use the same pattern as signIn - direct call to Amplify.Auth.signUp
        let operation = Amplify.Auth.signUp(
            username: email.lowercased(),
            password: password,
            options: options,
            listener: nil
        )
        
        do {
            let result: AuthSignUpResult = try await withCheckedThrowingContinuation { continuation in
                let cancellable = operation.resultPublisher
                    .first()
                    .sink(
                        receiveCompletion: { completion in
                            if case .failure(let error) = completion {
                                print("❌ [AuthService] SignUp publisher failed: \(error)")
                                continuation.resume(throwing: error)
                            }
                        },
                        receiveValue: { result in
                            print("✅ [AuthService] SignUp successful")
                            continuation.resume(returning: result)
                        }
                    )
                cancellables.insert(cancellable)
            }
            
            await MainActor.run {
                self.isLoading = false
            }
            
            return result
        } catch {
            // Log detailed error information
            print("❌ [AuthService] SignUp error: \(error)")
            print("❌ [AuthService] Error type: \(type(of: error))")
            if let authError = error as? AuthError {
                print("❌ [AuthService] AuthError errorDescription: \(authError.errorDescription ?? "nil")")
                print("❌ [AuthService] AuthError recoverySuggestion: \(authError.recoverySuggestion ?? "nil")")
            }
            if let nsError = error as NSError? {
                print("❌ [AuthService] Error domain: \(nsError.domain), code: \(nsError.code)")
                print("❌ [AuthService] Error userInfo: \(nsError.userInfo)")
                if let underlyingError = nsError.userInfo[NSUnderlyingErrorKey] as? NSError {
                    print("❌ [AuthService] Underlying error: \(underlyingError.localizedDescription)")
                    print("❌ [AuthService] Underlying error domain: \(underlyingError.domain), code: \(underlyingError.code)")
                }
            }
            
            // Use the comprehensive error handling helper (same as signIn)
            let friendlyMessage = getFriendlyErrorMessage(from: error, defaultMessage: "Sign up failed. Please try again.")
            
            await MainActor.run {
                self.isLoading = false
                self.errorMessage = friendlyMessage
            }
            throw error
        }
    }
    
    func confirmSignUp(email: String, confirmationCode: String) async throws {
        await MainActor.run {
            isLoading = true
            errorMessage = nil
        }
        
        let operation = Amplify.Auth.confirmSignUp(
            for: email.lowercased(),
            confirmationCode: confirmationCode.trimmingCharacters(in: .whitespacesAndNewlines),
            options: nil,
            listener: nil
        )
        
        do {
            let _ = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<AuthSignUpResult, Error>) in
                let cancellable = operation.resultPublisher
                    .first()
                    .sink(
                        receiveCompletion: { completion in
                            if case .failure(let error) = completion {
                                continuation.resume(throwing: error)
                            }
                        },
                        receiveValue: { result in
                            continuation.resume(returning: result)
                        }
                    )
                cancellables.insert(cancellable)
            }
            
            await MainActor.run {
                self.isLoading = false
            }
        } catch {
            // Log detailed error information
            print("❌ [AuthService] ConfirmSignUp error: \(error)")
            print("❌ [AuthService] Error type: \(type(of: error))")
            if let nsError = error as NSError? {
                print("❌ [AuthService] Error domain: \(nsError.domain), code: \(nsError.code)")
                print("❌ [AuthService] Error userInfo: \(nsError.userInfo)")
            }
            
            // Convert to human-readable message
            let friendlyMessage = getFriendlyErrorMessage(from: error, defaultMessage: "Verification failed. Please check your code and try again.")
            
            await MainActor.run {
                self.isLoading = false
                self.errorMessage = friendlyMessage
            }
            throw error
        }
    }
    
    func signIn(email: String, password: String) async throws {
        await MainActor.run {
            isLoading = true
            errorMessage = nil
        }
        
        let operation = Amplify.Auth.signIn(
            username: email.lowercased(),
            password: password,
            options: nil,
            listener: nil
        )
        
        do {
            let result = try await withCheckedThrowingContinuation { continuation in
                let cancellable = operation.resultPublisher
                    .first()
                    .sink(
                        receiveCompletion: { completion in
                            if case .failure(let error) = completion {
                                continuation.resume(throwing: error)
                            }
                        },
                        receiveValue: { result in
                            continuation.resume(returning: result)
                        }
                    )
                cancellables.insert(cancellable)
            }
            
            // Check if sign in was successful
            if result.isSignedIn {
                if let user = Amplify.Auth.getCurrentUser() {
                    await MainActor.run {
                        self.currentUser = user
                        self.isAuthenticated = true
                        self.userEmail = user.username
                        self.userId = user.userId
                        self.isLoading = false
                        loadUsername()
                    }
                } else {
                    await MainActor.run {
                        self.isLoading = false
                        self.errorMessage = "Could not retrieve user information"
                    }
                    throw AuthError.invalidCredentials
                }
            } else {
                await MainActor.run {
                    self.isLoading = false
                    self.errorMessage = "Sign in was not completed"
                }
                throw AuthError.invalidCredentials
            }
        } catch {
            // Log detailed error information
            print("❌ [AuthService] SignIn error: \(error)")
            print("❌ [AuthService] Error type: \(type(of: error))")
            if let authError = error as? AuthError {
                print("❌ [AuthService] AuthError errorDescription: \(authError.errorDescription ?? "nil")")
                print("❌ [AuthService] AuthError recoverySuggestion: \(authError.recoverySuggestion ?? "nil")")
            }
            if let nsError = error as NSError? {
                print("❌ [AuthService] Error domain: \(nsError.domain), code: \(nsError.code)")
                print("❌ [AuthService] Error userInfo: \(nsError.userInfo)")
                if let underlyingError = nsError.userInfo[NSUnderlyingErrorKey] as? NSError {
                    print("❌ [AuthService] Underlying error: \(underlyingError.localizedDescription)")
                    print("❌ [AuthService] Underlying error domain: \(underlyingError.domain), code: \(underlyingError.code)")
                }
            }
            
            // Convert to human-readable message
            let friendlyMessage = getFriendlyErrorMessage(from: error, defaultMessage: "Sign in failed. Please check your email and password.")
            
            await MainActor.run {
                self.isLoading = false
                self.errorMessage = friendlyMessage
            }
            throw error
        }
    }
    
    func signOut() async throws {
        await MainActor.run {
            isLoading = true
            errorMessage = nil
        }
        
        let operation = Amplify.Auth.signOut(options: nil, listener: nil)
        
        do {
            let _ = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                let cancellable = operation.resultPublisher
                    .first()
                    .sink(
                        receiveCompletion: { completion in
                            if case .failure(let error) = completion {
                                continuation.resume(throwing: error)
                            }
                        },
                        receiveValue: { _ in
                            continuation.resume(returning: ())
                        }
                    )
                cancellables.insert(cancellable)
            }
            
            await MainActor.run {
                self.isAuthenticated = false
                self.currentUser = nil
                self.userEmail = nil
                self.userId = nil
                self.username = nil
                self.isLoadingUsername = false
                self.isLoading = false
            }
        } catch {
            // Log detailed error information
            print("❌ [AuthService] SignOut error: \(error)")
            print("❌ [AuthService] Error type: \(type(of: error))")
            if let nsError = error as NSError? {
                print("❌ [AuthService] Error domain: \(nsError.domain), code: \(nsError.code)")
                print("❌ [AuthService] Error userInfo: \(nsError.userInfo)")
            }
            
            // Convert to human-readable message
            let friendlyMessage = getFriendlyErrorMessage(from: error, defaultMessage: "Sign out failed. Please try again.")
            
            await MainActor.run {
                self.isLoading = false
                self.errorMessage = friendlyMessage
            }
            throw error
        }
    }
    
    // MARK: - Error Handling Helper
    
    /// Converts technical errors to human-readable messages
    // Public function to get friendly error messages - can be called from views
    func getFriendlyErrorMessage(from error: Error, defaultMessage: String) -> String {
        // Log the full error for debugging
        print("🔍 [AuthService] Converting error to friendly message")
        print("   - Error: \(error)")
        print("   - Error type: \(type(of: error))")
        print("   - Error string representation: \(String(describing: error))")
        
        // FIRST: Check the error's string representation directly (most reliable)
        let errorString = String(describing: error).lowercased()
        print("   🔎 Checking error string representation: '\(errorString)'")
        
        // Check for "user already exists" patterns in the string representation
        if errorString.contains("already exists") ||
           errorString.contains("user already exists") ||
           errorString.contains("usernameexists") ||
           errorString.contains("username exists") {
            print("   ✅ MATCHED 'user already exists' in string representation - returning friendly message")
            return "An account with this email already exists. Please sign in instead."
        }
        
        // Check for Amplify AuthError
        if let authError = error as? AuthError {
            print("   - AuthError detected")
            print("   - errorDescription: '\(authError.errorDescription ?? "nil")'")
            print("   - recoverySuggestion: '\(authError.recoverySuggestion ?? "nil")'")
            
            // Map common AuthError cases to friendly messages
            let errorDesc = authError.errorDescription?.lowercased() ?? ""
            let recoverySuggestion = authError.recoverySuggestion?.lowercased() ?? ""
            
            // Debug logging - log to Xcode console
            print("🔍 [getFriendlyErrorMessage] Checking AuthError:")
            print("   📝 errorDesc: '\(errorDesc)'")
            print("   📝 recoverySuggestion: '\(recoverySuggestion)'")
            
            // Sign up errors - check for "user already exists" first (most common)
            // Check errorDescription FIRST (most reliable for AuthError)
            if errorDesc.contains("already exists") ||
               errorDesc.contains("user already exists") ||
               errorDesc.contains("usernameexists") ||
               errorDesc.contains("username exists") {
                print("   ✅ MATCHED 'user already exists' in errorDescription - returning friendly message")
                return "An account with this email already exists. Please sign in instead."
            }
            
            // Check recovery suggestion for "different username" (indicates user exists)
            if recoverySuggestion.contains("different username") ||
               recoverySuggestion.contains("already exists") {
                print("   ✅ MATCHED 'user already exists' in recoverySuggestion - returning friendly message")
                return "An account with this email already exists. Please sign in instead."
            }
            
            // Check underlying error if available (via NSError)
            var underlyingError: NSError? = nil
            if let nsError = error as NSError?,
               let underlying = nsError.userInfo[NSUnderlyingErrorKey] as? NSError {
                underlyingError = underlying
                print("   - underlyingError: \(underlying)")
                print("   - underlyingError domain: \(underlying.domain), code: \(underlying.code)")
                print("   - underlyingError description: \(underlying.localizedDescription)")
            }
            
            // Check underlying error for "usernameExists" or related messages
            if let underlying = underlyingError {
                let underlyingDesc = underlying.localizedDescription.lowercased()
                print("   🔎 Checking underlying error:")
                print("      - underlyingDesc: '\(underlyingDesc)'")
                if underlyingDesc.contains("already exists") ||
                   underlyingDesc.contains("user already exists") ||
                   underlyingDesc.contains("usernameexists") ||
                   underlyingDesc.contains("alias exists") {
                    print("   ✅ MATCHED underlying error 'user already exists' - returning friendly message")
                    return "An account with this email already exists. Please sign in instead."
                }
            }
            
            // Check for Amplify.AuthError code 1 - this is the "User already exists" error code
            if let nsError = error as NSError? {
                print("   🔎 Checking NSError:")
                print("      - Domain: '\(nsError.domain)'")
                print("      - Code: \(nsError.code)")
                // Amplify.AuthError code 1 is "User already exists"
                if nsError.domain == "Amplify.AuthError" && nsError.code == 1 {
                    print("   ✅ MATCHED AuthError code 1 (User already exists) - returning friendly message")
                    return "An account with this email already exists. Please sign in instead."
                }
            }
            
            // Password validation errors
            if errorDesc.contains("invalid password") ||
               (errorDesc.contains("password") && (errorDesc.contains("too short") || errorDesc.contains("minimum"))) {
                return "Password must be at least 8 characters long."
            }
            
            // Email validation errors
            if errorDesc.contains("invalid email") ||
               (errorDesc.contains("email") && errorDesc.contains("invalid")) {
                return "Please enter a valid email address."
            }
            
            // Sign in errors
            if errorDesc.contains("not authorized") || 
               errorDesc.contains("incorrect username or password") ||
               errorDesc.contains("invalid credentials") ||
               errorDesc.contains("authentication failed") {
                return "Incorrect email or password. Please try again."
            }
            
            // Check underlying error code for AWS Cognito errors (via NSError)
            if let nsError = error as NSError?,
               let underlyingError = nsError.userInfo[NSUnderlyingErrorKey] as? NSError,
               underlyingError.domain.contains("AWSCognitoIdentityProvider") {
                switch underlyingError.code {
                case 6: // AliasExistsException / UsernameExistsException
                    return "An account with this email already exists. Please sign in instead."
                case 16: // NotAuthorizedException
                    return "Incorrect email or password. Please try again."
                case 4: // UserNotFoundException
                    return "No account found with this email. Please sign up first."
                case 5: // UserNotConfirmedException
                    return "Please verify your email address before signing in."
                case 7: // TooManyFailedAttemptsException
                    return "Too many failed attempts. Please wait a few minutes and try again."
                default:
                    break
                }
            }
            
            // User already exists (sign-up error) - check this FIRST
            if errorDesc.contains("already exists") ||
               errorDesc.contains("user already exists") ||
               errorDesc.contains("usernameexists") ||
               errorDesc.contains("alias exists") ||
               errorDesc.contains("username already exists") ||
               errorDesc.contains("an account with the given email already exists") {
                return "An account with this email already exists. Please sign in instead."
            }
            
            // User not found
            if errorDesc.contains("user does not exist") ||
               errorDesc.contains("user not found") ||
               errorDesc.contains("does not exist") {
                return "No account found with this email. Please sign up first."
            }
            
            // User not confirmed
            if errorDesc.contains("not confirmed") ||
               errorDesc.contains("user is not confirmed") {
                return "Please verify your email address before signing in."
            }
            
            // Too many attempts
            if errorDesc.contains("too many attempts") ||
               errorDesc.contains("attempt limit exceeded") {
                return "Too many failed attempts. Please wait a few minutes and try again."
            }
            
            // Password reset errors
            if errorDesc.contains("invalid verification code") ||
               errorDesc.contains("code mismatch") ||
               errorDesc.contains("expired code") {
                return "Invalid or expired reset code. Please request a new code."
            }
            
            // Network errors
            if errorDesc.contains("network") ||
               errorDesc.contains("connection") ||
               errorDesc.contains("timeout") {
                return "Network error. Please check your internet connection and try again."
            }
            
            // Use recovery suggestion if available and helpful
            if !recoverySuggestion.isEmpty && 
               !recoverySuggestion.contains("amplify") &&
               !recoverySuggestion.contains("aws") {
                return recoverySuggestion.capitalized
            }
            
            // Use error description if it's user-friendly
            if !errorDesc.isEmpty && 
               !errorDesc.contains("amplify") &&
               !errorDesc.contains("aws") &&
               !errorDesc.contains("operation couldn't be completed") {
                return authError.errorDescription ?? defaultMessage
            }
        }
        
        // Check for NSError
        if let nsError = error as NSError? {
            print("   - NSError detected")
            print("   - Domain: \(nsError.domain), Code: \(nsError.code)")
            print("   - Description: \(nsError.localizedDescription)")
            print("   - UserInfo: \(nsError.userInfo)")
            
            let errorString = nsError.localizedDescription.lowercased()
            
            // Check for sign-up specific errors first - expanded patterns
            if errorString.contains("already exists") ||
               errorString.contains("user already exists") ||
               errorString.contains("usernameexists") ||
               errorString.contains("alias exists") ||
               errorString.contains("username already exists") ||
               errorString.contains("an account with the given email already exists") {
                return "An account with this email already exists. Please sign in instead."
            }
            
            // Check underlying error FIRST (before main error string)
            if let underlyingError = nsError.userInfo[NSUnderlyingErrorKey] as? NSError {
                print("   - Underlying error domain: \(underlyingError.domain), code: \(underlyingError.code)")
                print("   - Underlying error description: \(underlyingError.localizedDescription)")
                
                let underlyingString = underlyingError.localizedDescription.lowercased()
                
                // AWS Cognito error codes - check these FIRST
                if underlyingError.domain.contains("AWSCognitoIdentityProvider") ||
                   underlyingError.domain.contains("com.amazonaws.cognitoidentityprovider") {
                    switch underlyingError.code {
                    case 6: // AliasExistsException / UsernameExistsException
                        return "An account with this email already exists. Please sign in instead."
                    case 16: // NotAuthorizedException
                        return "Incorrect email or password. Please try again."
                    case 4: // UserNotFoundException
                        return "No account found with this email. Please sign up first."
                    case 5: // UserNotConfirmedException
                        return "Please verify your email address before signing in."
                    case 7: // TooManyFailedAttemptsException
                        return "Too many failed attempts. Please wait a few minutes and try again."
                    default:
                        break
                    }
                }
                
                // Check underlying error description - expanded patterns
                if underlyingString.contains("already exists") ||
                   underlyingString.contains("user already exists") ||
                   underlyingString.contains("usernameexists") ||
                   underlyingString.contains("alias exists") ||
                   underlyingString.contains("username already exists") ||
                   underlyingString.contains("an account with the given email already exists") {
                    return "An account with this email already exists. Please sign in instead."
                }
                // Sign-in errors
                if underlyingString.contains("not authorized") ||
                   underlyingString.contains("incorrect") ||
                   underlyingString.contains("invalid password") {
                    return "Incorrect email or password. Please try again."
                }
                if underlyingString.contains("does not exist") ||
                   underlyingString.contains("user not found") {
                    return "No account found with this email. Please sign up first."
                }
                if underlyingString.contains("not confirmed") {
                    return "Please verify your email address before signing in."
                }
            }
            
            // Check main error description
            if errorString.contains("not authorized") ||
               errorString.contains("incorrect username or password") ||
               errorString.contains("invalid credentials") {
                return "Incorrect email or password. Please try again."
            }
            if errorString.contains("user does not exist") ||
               errorString.contains("user not found") {
                return "No account found with this email. Please sign up first."
            }
            if errorString.contains("network") ||
               errorString.contains("connection") ||
               errorString.contains("timeout") {
                return "Network error. Please check your internet connection and try again."
            }
        }
        
        // Fallback to default message
        print("   ❌ NO MATCHES FOUND - Using default message: '\(defaultMessage)'")
        return defaultMessage
    }
    
    func loadUsername() {
        guard let userId = userId, let userEmail = userEmail else {
            print("⚠️ [AuthService] Cannot load username - missing userId or userEmail")
            print("   - userId: \(userId ?? "nil")")
            print("   - userEmail: \(userEmail ?? "nil")")
            Task { @MainActor in
                self.isLoadingUsername = false
            }
            return
        }
        
        // If we already have a username, don't reload unnecessarily
        if username != nil {
            print("🔍 [AuthService] Username already loaded: \(username ?? "nil"), skipping reload")
            Task { @MainActor in
                self.isLoadingUsername = false
            }
            return
        }
        
        // If already loading, check if it's actually stuck (no username after reasonable time)
        // If so, reset and retry
        if isLoadingUsername {
            print("⚠️ [AuthService] Username load already in progress - checking if stuck")
            // Give it a moment, then check if still stuck
            Task {
                try? await Task.sleep(nanoseconds: 3_000_000_000) // 3 seconds
                await MainActor.run {
                    // If still loading and no username, it's stuck - reset and retry
                    if self.isLoadingUsername && self.username == nil {
                        print("⚠️ [AuthService] Username load appears stuck - resetting and retrying")
                        self.isLoadingUsername = false
                        // Retry the load
                        self.loadUsername()
                    }
                }
            }
            return
        }
        
        print("🔍 [AuthService] Loading username for userId: \(userId), email: \(userEmail)")
        
        Task {
            do {
                // Set loading state
                await MainActor.run {
                    self.isLoadingUsername = true
                }
                
                // Fetch username from API (timeout handled by ChannelService - 10 seconds)
                let username = try await ChannelService.shared.fetchUsername(userId: userId, email: userEmail)
                
                print("🔍 [AuthService] Username fetch result: \(username ?? "nil")")
                await MainActor.run {
                    self.username = username
                    self.isLoadingUsername = false
                    print("✅ [AuthService] Username loaded: \(username ?? "nil"), isLoadingUsername: false")
                }
            } catch {
                print("❌ [AuthService] Could not load username: \(error.localizedDescription)")
                print("   - Error type: \(type(of: error))")
                if let nsError = error as NSError? {
                    print("   - Error domain: \(nsError.domain), code: \(nsError.code)")
                    
                    // Handle 403 errors specifically (Netlify security challenge)
                    if nsError.code == 403 {
                        print("⚠️ [AuthService] 403 error - likely Netlify security challenge blocking request")
                    }
                }
                // Username might not be set yet, that's okay - don't block the app
                // User can set username later if needed
                await MainActor.run {
                    self.username = nil
                    self.isLoadingUsername = false
                    print("⚠️ [AuthService] Username set to nil, isLoadingUsername: false (non-blocking error)")
                    print("   - User can set username in the username setup screen")
                }
            }
        }
    }
    
    
    func checkUsernameAvailability(username: String) async throws -> Bool {
        guard let userId = userId else {
            throw AuthError.notAuthenticated
        }
        
        return try await ChannelService.shared.checkUsernameAvailability(username: username, userId: userId)
    }
    
    func updateUsername(_ newUsername: String) async throws {
        guard let userId = userId, let userEmail = userEmail else {
            throw AuthError.notAuthenticated
        }
        
        isLoading = true
        errorMessage = nil
        
        do {
            try await ChannelService.shared.updateUsername(
                userId: userId,
                username: newUsername,
                email: userEmail
            )
            
            await MainActor.run {
                self.username = newUsername
                self.isLoading = false
            }
        } catch {
            await MainActor.run {
                self.isLoading = false
                self.errorMessage = error.localizedDescription
            }
            throw error
        }
    }
    
    // MARK: - Password Reset
    
    func forgotPassword(email: String) async throws {
        await MainActor.run {
            isLoading = true
            errorMessage = nil
        }
        
        let operation = Amplify.Auth.resetPassword(
            for: email.lowercased(),
            options: nil,
            listener: nil
        )
        
        do {
            let _ = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<AuthResetPasswordResult, Error>) in
                let cancellable = operation.resultPublisher
                    .first()
                    .sink(
                        receiveCompletion: { completion in
                            if case .failure(let error) = completion {
                                print("❌ [AuthService] ForgotPassword publisher failed: \(error)")
                                continuation.resume(throwing: error)
                            }
                        },
                        receiveValue: { result in
                            print("✅ [AuthService] ForgotPassword successful - code sent to email")
                            continuation.resume(returning: result)
                        }
                    )
                cancellables.insert(cancellable)
            }
            
            await MainActor.run {
                self.isLoading = false
            }
        } catch {
            // Log detailed error information
            print("❌ [AuthService] ForgotPassword error: \(error)")
            print("❌ [AuthService] Error type: \(type(of: error))")
            if let nsError = error as NSError? {
                print("❌ [AuthService] Error domain: \(nsError.domain), code: \(nsError.code)")
                print("❌ [AuthService] Error userInfo: \(nsError.userInfo)")
            }
            
            // Convert to human-readable message
            let friendlyMessage = getFriendlyErrorMessage(from: error, defaultMessage: "Failed to send password reset code. Please try again.")
            
            await MainActor.run {
                self.isLoading = false
                self.errorMessage = friendlyMessage
            }
            throw error
        }
    }
    
    func confirmResetPassword(email: String, confirmationCode: String, newPassword: String) async throws {
        await MainActor.run {
            isLoading = true
            errorMessage = nil
        }
        
        let operation = Amplify.Auth.confirmResetPassword(
            for: email.lowercased(),
            with: newPassword,
            confirmationCode: confirmationCode.trimmingCharacters(in: .whitespacesAndNewlines),
            options: nil,
            listener: nil
        )
        
        do {
            let _ = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                let cancellable = operation.resultPublisher
                    .first()
                    .sink(
                        receiveCompletion: { completion in
                            if case .failure(let error) = completion {
                                print("❌ [AuthService] ConfirmResetPassword publisher failed: \(error)")
                                continuation.resume(throwing: error)
                            }
                        },
                        receiveValue: { _ in
                            print("✅ [AuthService] ConfirmResetPassword successful - password reset")
                            continuation.resume(returning: ())
                        }
                    )
                cancellables.insert(cancellable)
            }
            
            await MainActor.run {
                self.isLoading = false
            }
        } catch {
            // Log detailed error information
            print("❌ [AuthService] ConfirmResetPassword error: \(error)")
            print("❌ [AuthService] Error type: \(type(of: error))")
            if let nsError = error as NSError? {
                print("❌ [AuthService] Error domain: \(nsError.domain), code: \(nsError.code)")
                print("❌ [AuthService] Error userInfo: \(nsError.userInfo)")
            }
            
            // Convert to human-readable message
            let friendlyMessage = getFriendlyErrorMessage(from: error, defaultMessage: "Failed to reset password. Please check your code and try again.")
            
            await MainActor.run {
                self.isLoading = false
                self.errorMessage = friendlyMessage
            }
            throw error
        }
    }
}

enum AuthError: LocalizedError {
    case notAuthenticated
    case invalidCredentials
    case networkError
    
    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "You must be signed in to perform this action"
        case .invalidCredentials:
            return "Invalid email or password"
        case .networkError:
            return "Network error. Please check your connection"
        }
    }
}

