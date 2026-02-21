//
//  TwillyLogoView.swift
//  TwillyBroadcaster
//
//  Twilly logo with animated streaming bars matching the web app style
//

import SwiftUI

struct TwillyLogoView: View {
    var body: some View {
        Text("Twilly")
            .font(.system(size: 26, weight: .black, design: .rounded))
            .foregroundStyle(
                LinearGradient(
                    gradient: Gradient(colors: [
                        Color.twillyTeal,
                        Color.twillyCyan,
                        Color.twillyTeal
                    ]),
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .shadow(color: Color.twillyCyan.opacity(0.6), radius: 6, x: 0, y: 3)
            .shadow(color: Color.twillyTeal.opacity(0.4), radius: 3, x: 0, y: 1)
    }
}

// MARK: - Streaming Bar Component

struct StreamingBar: View {
    let height: CGFloat
    let delay: CGFloat
    let animationPhase: CGFloat
    
    var body: some View {
        RoundedRectangle(cornerRadius: 0.5)
            .fill(Color.black)
            .frame(width: 2, height: barHeight)
    }
    
    private var barHeight: CGFloat {
        // Animate height with delay and phase
        let baseHeight = height
        let animationOffset = sin((animationPhase + delay) * .pi * 2) * 2
        return max(2, baseHeight + animationOffset)
    }
}

// MARK: - Brand Colors

extension Color {
    // Twilly teal (#14B8A6 / teal-400)
    static let twillyTeal = Color(red: 0.078, green: 0.722, blue: 0.651) // #14B8A6
    
    // Twilly cyan (#06B6A6 / cyan-400)
    static let twillyCyan = Color(red: 0.024, green: 0.714, blue: 0.651) // #06B6A6
    
    // Legacy teal for compatibility
    static let twillyTealLegacy = Color(red: 0.243, green: 0.898, blue: 1.0) // #3EE5FF
}


