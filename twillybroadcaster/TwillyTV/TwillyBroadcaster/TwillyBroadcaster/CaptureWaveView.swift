//
//  CaptureWaveView.swift
//  TwillyBroadcaster
//
//  Animated wave visual for Twilly capture indicator
//

import SwiftUI

struct CaptureWaveView: View {
    @State private var animationPhase: Double = 0
    
    var body: some View {
        TimelineView(.periodic(from: .now, by: 0.03)) { context in
            HStack(spacing: 3) {
                ForEach(0..<5, id: \.self) { index in
                    WaveBar(index: index, time: context.date.timeIntervalSince1970)
                }
            }
        }
    }
}

private struct WaveBar: View {
    let index: Int
    let time: TimeInterval
    
    private var height: CGFloat {
        let baseHeight: CGFloat = 12 // Increased base height for more visibility
        let delays: [Double] = [0.0, 0.2, 0.4, 0.6, 0.3] // Staggered delays for wave effect
        let delay = delays[index]
        // More active animation - faster speed and larger amplitude
        let phase = time * 5 + delay // Increased speed (5x instead of 3x)
        let heightVariation = sin(phase) * 8 // Increased amplitude (8 instead of 3) for more movement
        return max(6, baseHeight + heightVariation) // Larger range of movement
    }
    
    var body: some View {
        RoundedRectangle(cornerRadius: 2)
            .fill(
                LinearGradient(
                    gradient: Gradient(colors: [
                        Color.twillyTeal,
                        Color.twillyCyan,
                        Color.twillyTeal
                    ]),
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .frame(width: 3, height: height)
    }
}

// Alternative: Smooth continuous wave animation
struct SmoothWaveView: View {
    @State private var animationPhase: CGFloat = 0
    
    var body: some View {
        GeometryReader { geometry in
            Path { path in
                let width = geometry.size.width
                let height = geometry.size.height
                let centerY = height / 2
                let amplitude: CGFloat = 8
                let frequency: CGFloat = 2
                
                path.move(to: CGPoint(x: 0, y: centerY))
                
                for x in stride(from: 0, through: width, by: 1) {
                    let y = centerY + amplitude * sin((x / width * frequency * .pi * 2) + animationPhase)
                    path.addLine(to: CGPoint(x: x, y: y))
                }
            }
            .stroke(
                LinearGradient(
                    gradient: Gradient(colors: [
                        Color.twillyTeal,
                        Color.twillyCyan,
                        Color.twillyTeal
                    ]),
                    startPoint: .leading,
                    endPoint: .trailing
                ),
                style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round)
            )
        }
        .frame(height: 24)
        .onAppear {
            withAnimation(.linear(duration: 1.5).repeatForever(autoreverses: false)) {
                animationPhase = .pi * 2
            }
        }
    }
}

